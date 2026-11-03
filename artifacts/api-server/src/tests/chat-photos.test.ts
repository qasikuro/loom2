import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { and, eq, inArray } from 'drizzle-orm';
import { db, characterTable, messages as messagesTable } from '@workspace/db';
import { createTestApp, setTestUserId } from './helpers/testApp';

const storage = vi.hoisted(() => ({ owner: '', stranger: '' }));
vi.mock('../lib/objectStorage', () => ({
  objectStorageClient: {
    bucket: () => ({
      file: (path: string) => ({
        getMetadata: async () => [{
          size: '5',
          contentType: path.startsWith('videos/') ? 'video/mp4' : 'image/png',
          metadata: { ownerUserId: path.includes('foreign') ? storage.stranger : storage.owner },
        }],
        createReadStream: () => Readable.from(Buffer.from(path.startsWith('videos/') ? 'video' : 'photo')),
      }),
    }),
  },
  ObjectNotFoundError: class extends Error {},
  ObjectStorageService: class {},
}));

import messagesRouter from '../routes/messages';
import mediaRouter from '../routes/media-assets';
import { canReadChatMedia } from '../lib/mediaAccess';

const prefix = `chat-photo-${randomUUID()}`;
const sender = `${prefix}-sender`;
const recipient = `${prefix}-recipient`;
const stranger = `${prefix}-stranger`;
const users = [sender, recipient, stranger];
const imageUri = `/api/images/${prefix}.png`;
const videoUri = `/api/videos/${prefix}.mp4`;
const thumbnailUri = `/api/images/${prefix}-poster.jpg`;
const app = createTestApp();
app.use('/api', messagesRouter);
app.use('/api', mediaRouter);
let id: string;
let ticketUrl: string;

beforeAll(async () => {
  storage.owner = sender;
  storage.stranger = stranger;
  process.env.SESSION_SECRET = 'chat-photo-test-signing-only';
  await db.insert(characterTable).values(users.map(userId => ({
    userId, name: userId, username: userId, isPublic: false,
  })));
});

afterAll(async () => {
  const { pool } = await import('@workspace/db');
  await pool.query('DELETE FROM blocks WHERE blocker_id=ANY($1) OR blocked_id=ANY($1)', [users]);
  await db.delete(messagesTable).where(inArray(messagesTable.fromUserId, users));
  await db.delete(characterTable).where(inArray(characterTable.userId, users));
});

describe('private chat photos', () => {
  it('rejects external URLs, video paths, and another person’s photo', async () => {
    setTestUserId(sender);
    for (const uri of ['https://example.com/photo.png', '/api/videos/movie.mp4', 'data:image/png;base64,abc']) {
      const response = await request(app).post(`/api/messages/${recipient}`).send({ imageUri: uri });
      expect(response.status).toBe(400);
    }
    const foreign = await request(app).post(`/api/messages/${recipient}`).send({ imageUri: '/api/images/foreign.png' });
    expect(foreign.status).toBe(403);
    const foreignVideo = await request(app).post(`/api/messages/${recipient}/videos`).send({ videoUri: '/api/videos/foreign.mp4' });
    expect(foreignVideo.status).toBe(403);
  });

  it('sends captioned videos with private poster access and inbox previews', async () => {
    setTestUserId(sender);
    const clientMessageId = randomUUID();
    const sent = await request(app).post(`/api/messages/${recipient}/videos`).send({
      clientMessageId, videoUri, thumbnailUri,
    });
    expect(sent.status).toBe(201);
    expect(sent.body.videoUri).toBe(videoUri);
    expect(sent.body.thumbnailUri).toBe(thumbnailUri);
    expect(sent.body.content).toBeNull();
    const replay = await request(app).post(`/api/messages/${recipient}/videos`).send({
      clientMessageId, videoUri, thumbnailUri,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(sent.body.id);
    const conflict = await request(app).post(`/api/messages/${recipient}/videos`).send({
      clientMessageId, videoUri: `/api/videos/${prefix}-different.mp4`, thumbnailUri,
    });
    expect(conflict.status).toBe(409);

    setTestUserId(recipient);
    const history = await request(app).get(`/api/messages/${sender}?limit=100`);
    const message = history.body.find((item: { id: string }) => item.id === sent.body.id);
    expect(message.videoUri).toBe(videoUri);
    expect(message.thumbnailUri).toBe(thumbnailUri);
    expect((await request(app).get('/api/messages')).body.find(
      (thread: { partnerId: string }) => thread.partnerId === sender,
    ).lastMessage).toBe('Video');

    const links = await request(app).post('/api/media/read-urls').send({ paths: [videoUri, thumbnailUri] });
    expect(links.status).toBe(200);
    expect(links.body.urls[videoUri]).toContain('?ticket=');
    expect(links.body.urls[thumbnailUri]).toContain('?ticket=');
    expect((await request(app).get(links.body.urls[videoUri])).status).toBe(200);

    setTestUserId(stranger);
    const denied = await request(app).post('/api/media/read-urls').send({ paths: [videoUri, thumbnailUri] });
    expect(denied.body.urls).toEqual({});
  });

  it('sends a photo without requiring text and returns it in history and inbox', async () => {
    setTestUserId(sender);
    await db.insert(messagesTable).values(Array.from({ length: 205 }, (_, i) => ({
      fromUserId: sender, toUserId: recipient, content: `Older message ${i}`,
      createdAt: new Date(Date.now() - 60_000 - i * 1000),
    })));
    const sent = await request(app).post(`/api/messages/${recipient}/photos`).send({ imageUri });
    expect(sent.status).toBe(201);
    expect(sent.body.imageUri).toBe(imageUri);
    expect(sent.body.content).toBeNull();
    id = sent.body.id;
    setTestUserId(recipient);
    const history = await request(app).get(`/api/messages/${sender}?limit=100`);
    expect(history.body).toHaveLength(100);
    expect(history.body[99].id).toBe(id);
    expect(history.body.find((m: { id: string }) => m.id === id).imageUri).toBe(imageUri);
    const inbox = await request(app).get('/api/messages');
    expect(inbox.body.find((t: { partnerId: string }) => t.partnerId === sender).lastMessage).toBe('Photo');
  });

  it('issues private recipient read links but denies unrelated readers', async () => {
    setTestUserId(recipient);
    const links = await request(app).post('/api/media/read-urls').send({ paths: [imageUri] });
    expect(links.status).toBe(200);
    ticketUrl = links.body.urls[imageUri];
    expect(ticketUrl).toContain('?ticket=');
    expect((await request(app).get(ticketUrl)).status).toBe(200);
    setTestUserId(stranger);
    expect((await request(app).post('/api/media/read-urls').send({ paths: [imageUri] })).body.urls).toEqual({});
    expect((await request(app).get(imageUri)).status).toBe(404);
  });

  it('revokes already issued recipient tickets on blocking in either direction', async () => {
    const { pool } = await import('@workspace/db');
    for (const [a, b] of [[sender, recipient], [recipient, sender]]) {
      await pool.query('INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2)', [a, b]);
      setTestUserId(recipient);
      expect(await canReadChatMedia(imageUri, recipient, sender)).toBe(false);
      expect(await canReadChatMedia(videoUri, recipient, sender)).toBe(false);
      expect((await request(app).get(ticketUrl)).status).toBe(404);
      await pool.query('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2', [a, b]);
    }
    expect(await canReadChatMedia(imageUri, recipient, sender)).toBe(true);
  });

  it('denies recipient reads during suspension and keeps captions', async () => {
    await db.update(characterTable).set({ suspendedUntil: new Date(Date.now() + 60_000) }).where(eq(characterTable.userId, sender));
    expect(await canReadChatMedia(imageUri, recipient, sender)).toBe(false);
    await db.update(characterTable).set({ suspendedUntil: null }).where(eq(characterTable.userId, sender));
    setTestUserId(sender);
    const sent = await request(app).post(`/api/messages/${recipient}/photos`).send({ imageUri, content: 'Our adventure' });
    expect(sent.status).toBe(201);
    expect(sent.body.content).toBe('Our adventure');
    await db.delete(messagesTable).where(eq(messagesTable.id, sent.body.id));
  });

  it('keeps recipient access after sender-only deletion, but revokes it after a recipient clear', async () => {
    setTestUserId(recipient);
    await db.update(messagesTable).set({ deletedAt: new Date(), deletedFor: 'sender' }).where(eq(messagesTable.id, id));
    expect(await canReadChatMedia(imageUri, recipient, sender)).toBe(true);
    await db.update(messagesTable).set({ deletedFor: 'both' }).where(eq(messagesTable.id, id));
    expect(await canReadChatMedia(imageUri, recipient, sender)).toBe(false);
    expect((await request(app).get(ticketUrl)).status).toBe(404);
    await db.update(messagesTable).set({ deletedFor: 'recipient' }).where(and(eq(messagesTable.id, id), eq(messagesTable.fromUserId, sender)));
    expect(await canReadChatMedia(imageUri, recipient, sender)).toBe(false);
  });
});
