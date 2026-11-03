import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, characterTable, messages as messagesTable } from '@workspace/db';
import { createTestApp, setTestUserId } from './helpers/testApp';
import messagesRouter from '../routes/messages';

const app = createTestApp();
app.use('/api', messagesRouter);
const prefix = `drawer-test-${randomUUID()}`;
const viewer = `${prefix}-viewer`;
const outgoingBlock = `${prefix}-outgoing`;
const incomingBlock = `${prefix}-incoming`;
const banned = `${prefix}-banned`;
const neutral = `${prefix}-neutral`;
const users = [viewer, outgoingBlock, incomingBlock, banned, neutral];
const messageIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

beforeAll(async () => {
  await db.insert(characterTable).values(users.map(userId => ({
    userId, name: prefix, isPublic: true, isBanned: userId === banned,
  })));
  await db.execute(sql`INSERT INTO blocks (blocker_id, blocked_id) VALUES
    (${viewer}, ${outgoingBlock}), (${incomingBlock}, ${viewer})`);
  await db.insert(messagesTable).values([outgoingBlock, incomingBlock, banned, neutral].map((fromUserId, index) => ({
    id: messageIds[index], fromUserId, toUserId: viewer, content: 'Drawer privacy test', isRead: false,
  })));
});

afterAll(async () => {
  await db.delete(messagesTable).where(inArray(messagesTable.id, messageIds));
  await db.execute(sql`DELETE FROM blocks WHERE blocker_id IN (${viewer}, ${incomingBlock}) AND blocked_id IN (${viewer}, ${outgoingBlock})`);
  await db.delete(characterTable).where(inArray(characterTable.userId, users));
});

describe('drawer uses the private existing inbox', () => {
  it('keeps blocked partners and their existing history visible, while excluding banned partners', async () => {
    setTestUserId(viewer);
    const response = await request(app).get('/api/messages');
    expect(response.status).toBe(200);
    const rows = response.body as { partnerId: string; unread: boolean }[];
    const partnerIds = rows.map(row => row.partnerId);
    expect(partnerIds).toEqual(expect.arrayContaining([outgoingBlock, incomingBlock, neutral]));
    expect(partnerIds).not.toContain(banned);
    expect(rows.find(row => row.partnerId === neutral)?.unread).toBe(true);
    const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageIds[3]));
    expect(message.isRead).toBe(false);
  });

  it('allows reading existing history in both blocked relationship directions', async () => {
    setTestUserId(viewer);
    for (const partner of [outgoingBlock, incomingBlock]) {
      const response = await request(app).get(`/api/messages/${partner}`);
      expect(response.status).toBe(200);
      expect(response.body.map((row: { id: string }) => row.id)).toContain(messageIds[partner === outgoingBlock ? 0 : 1]);
    }
  });

  it('still opens the allowed existing conversation', async () => {
    setTestUserId(viewer);
    const response = await request(app).get(`/api/messages/${neutral}`);
    expect(response.status).toBe(200);
    expect(response.body[0].id).toBe(messageIds[3]);
    expect(response.body[0].fromUserId).toBe(neutral);
  });

  it('lets a user delete the chat from their inbox without deleting the partner copy', async () => {
    setTestUserId(viewer);
    const cleared = await request(app).delete(`/api/messages/conversation/${neutral}`);
    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual({ cleared: true });

    const viewerCopy = await request(app).get(`/api/messages/${neutral}`);
    expect(viewerCopy.status).toBe(200);
    expect(viewerCopy.body).toEqual([]);

    setTestUserId(neutral);
    const partnerCopy = await request(app).get(`/api/messages/${viewer}`);
    expect(partnerCopy.status).toBe(200);
    expect(partnerCopy.body.map((row: { id: string }) => row.id)).toContain(messageIds[3]);
  });

  it('does not offer a banned user in Find search', async () => {
    setTestUserId(viewer);
    const response = await request(app).get(`/api/users/search?q=${encodeURIComponent(prefix)}`);
    expect(response.status).toBe(200);
    expect((response.body as { userId: string }[]).map(row => row.userId)).toEqual([neutral]);
  });

  it('always returns JSON for conditional friends, requests and chat refreshes', async () => {
    setTestUserId(viewer);
    for (const path of ['/friends', '/friends/requests', '/messages', `/messages/${neutral}`]) {
      const first = await request(app).get(`/api${path}`);
      expect(first.status).toBe(200);
      expect(first.headers['cache-control']).toBe('private, no-store');
      expect(first.headers.etag).toBeTruthy();
      const refresh = await request(app).get(`/api${path}`).set('If-None-Match', first.headers.etag);
      expect(refresh.status).toBe(200);
      expect(Array.isArray(refresh.body)).toBe(true);
    }
  });

  it('keeps both deletions independent and shows only newly delivered messages', async () => {
    setTestUserId(neutral);
    expect((await request(app).delete(`/api/messages/conversation/${viewer}`)).status).toBe(200);
    expect((await request(app).get(`/api/messages/${viewer}`)).body).toEqual([]);
    setTestUserId(viewer);
    expect((await request(app).get(`/api/messages/${neutral}`)).body).toEqual([]);

    const freshId = randomUUID();
    messageIds.push(freshId);
    await db.insert(messagesTable).values({
      id: freshId, fromUserId: neutral, toUserId: viewer, content: 'New conversation',
    });
    for (const [actor, partner] of [[viewer, neutral], [neutral, viewer]]) {
      setTestUserId(actor);
      const thread = await request(app).get(`/api/messages/${partner}`);
      expect(thread.status).toBe(200);
      expect(thread.body.map((row: { id: string }) => row.id)).toEqual([freshId]);
    }
  });
});
