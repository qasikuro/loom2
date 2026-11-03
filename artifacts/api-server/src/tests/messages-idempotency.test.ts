import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, characterTable, messages as messagesTable } from '@workspace/db';
import { createTestApp, setTestUserId } from './helpers/testApp';
import messagesRouter from '../routes/messages';

const prefix = `chat-idempotency-${randomUUID()}`;
const sender = `${prefix}-sender`;
const recipient = `${prefix}-recipient`;
const stranger = `${prefix}-stranger`;
const users = [sender, recipient, stranger];
const app = createTestApp();
app.use('/api', messagesRouter);

beforeAll(async () => {
  await db.insert(characterTable).values(users.map(userId => ({
    userId, name: userId, username: userId, isPublic: true,
  })));
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM blocks WHERE blocker_id IN (${sender}, ${recipient}, ${stranger})`);
  await db.delete(messagesTable).where(inArray(messagesTable.fromUserId, users));
  await db.delete(messagesTable).where(inArray(messagesTable.toUserId, users));
  await db.delete(characterTable).where(inArray(characterTable.userId, users));
});

describe('DM idempotent sends', () => {
  it('returns the original message on repeated client IDs without inserting duplicates', async () => {
    const clientMessageId = randomUUID();
    setTestUserId(sender);
    const body = { clientMessageId, content: 'safe retry' };
    const first = await request(app).post(`/api/messages/${recipient}`).send(body);
    const retry = await request(app).post(`/api/messages/${recipient}`).send(body);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(clientMessageId);
    expect(retry.body.id).toBe(first.body.id);
    const rows = await db.select().from(messagesTable).where(eq(messagesTable.id, clientMessageId));
    expect(rows).toHaveLength(1);
  });

  it('rejects reuse of an ID for a different payload or participant', async () => {
    const clientMessageId = randomUUID();
    setTestUserId(sender);
    const first = await request(app).post(`/api/messages/${recipient}`)
      .send({ clientMessageId, content: 'original content' });
    expect(first.status).toBe(201);

    const changedPayload = await request(app).post(`/api/messages/${recipient}`)
      .send({ clientMessageId, content: 'different content' });
    expect(changedPayload.status).toBe(409);

    setTestUserId(stranger);
    const changedSender = await request(app).post(`/api/messages/${recipient}`)
      .send({ clientMessageId, content: 'original content' });
    expect(changedSender.status).toBe(409);
  });

  it('handles simultaneous retries with one persisted row', async () => {
    const clientMessageId = randomUUID();
    setTestUserId(sender);
    const body = { clientMessageId, content: 'concurrent retry' };
    const responses = await Promise.all([
      request(app).post(`/api/messages/${recipient}`).send(body),
      request(app).post(`/api/messages/${recipient}`).send(body),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
    expect(responses[0].body.id).toBe(clientMessageId);
    expect(responses[1].body.id).toBe(clientMessageId);
    const rows = await db.select().from(messagesTable).where(and(
      eq(messagesTable.id, clientMessageId),
      eq(messagesTable.fromUserId, sender),
    ));
    expect(rows).toHaveLength(1);
  });

  it('does not resurrect deleted or per-user-cleared messages on a delayed retry', async () => {
    setTestUserId(sender);
    const clientMessageId = randomUUID();
    const body = { clientMessageId, content: 'delete only my copy' };
    expect((await request(app).post(`/api/messages/${recipient}`).send(body)).status).toBe(201);
    expect((await request(app).delete(`/api/messages/${clientMessageId}?forEveryone=false`)).status).toBe(200);
    expect((await request(app).post(`/api/messages/${recipient}`).send(body)).status).toBe(410);
    setTestUserId(recipient);
    const retained = await request(app).get(`/api/messages/${sender}`);
    expect(retained.body.some((row: { id: string }) => row.id === clientMessageId)).toBe(true);

    setTestUserId(sender);
    const clearedId = randomUUID();
    const clearedBody = { clientMessageId: clearedId, content: 'clear only my conversation' };
    expect((await request(app).post(`/api/messages/${recipient}`).send(clearedBody)).status).toBe(201);
    expect((await request(app).delete(`/api/messages/conversation/${recipient}`)).status).toBe(200);
    expect((await request(app).post(`/api/messages/${recipient}`).send(clearedBody)).status).toBe(410);
  });

  it('enforces blocking even for a previously accepted message ID', async () => {
    setTestUserId(sender);
    const body = { clientMessageId: randomUUID(), content: 'accepted before blocking' };
    expect((await request(app).post(`/api/messages/${recipient}`).send(body)).status).toBe(201);
    await db.execute(sql`INSERT INTO blocks (blocker_id, blocked_id) VALUES (${recipient}, ${sender}) ON CONFLICT DO NOTHING`);
    expect((await request(app).post(`/api/messages/${recipient}`).send(body)).status).toBe(403);
    expect((await request(app).post(`/api/messages/${recipient}`).send({ clientMessageId: randomUUID(), content: 'blocked new send' })).status).toBe(403);
    await db.execute(sql`DELETE FROM blocks WHERE blocker_id = ${recipient} AND blocked_id = ${sender}`);
  });

  it('does not undo an everyone-deletion when a later delete-for-me request is retried', async () => {
    setTestUserId(sender);
    const id = randomUUID();
    expect((await request(app).post(`/api/messages/${recipient}`).send({ clientMessageId: id, content: 'erase both copies' })).status).toBe(201);
    expect((await request(app).delete(`/api/messages/${id}?forEveryone=true`)).status).toBe(200);
    expect((await request(app).delete(`/api/messages/${id}?forEveryone=false`)).status).toBe(200);
    setTestUserId(recipient);
    const response = await request(app).get(`/api/messages/${sender}`);
    expect(response.body.some((row: { id: string }) => row.id === id)).toBe(false);
  });

  it('returns bounded, non-overlapping keyset pages and reports local API latency', async () => {
    const fixtureTime = Date.now();
    await db.insert(messagesTable).values(Array.from({ length: 200 }, (_, i) => ({
      fromUserId: sender, toUserId: stranger, content: `pagination fixture ${i}`,
      createdAt: new Date(fixtureTime + Math.floor(i / 3)), isRead: true,
    })));
    setTestUserId(sender);
    const times: number[] = [];
    let before: { id: string; createdAt: string } | undefined;
    const ids = new Set<string>();
    for (let page = 0; page < 4; page++) {
      const query = before
        ? `?limit=50&before=${encodeURIComponent(before.createdAt)}&beforeId=${before.id}` : '?limit=50';
      const start = performance.now();
      const response = await request(app).get(`/api/messages/${stranger}${query}`);
      times.push(performance.now() - start);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(50);
      for (const row of response.body) {
        expect(ids.has(row.id)).toBe(false);
        ids.add(row.id);
      }
      before = response.body[0];
    }
    expect(ids.size).toBe(200);
    console.info('DM API fixture measurement (local, not device/network):', JSON.stringify({
      seededMessages: 200, pageSize: 50, requests: times.length,
      responseMs: times.map(time => Math.round(time * 10) / 10),
    }));
  });
});
