import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { inArray } from 'drizzle-orm';

// ── Clerk mocks (hoisted by Vitest before any imports) ────────────────────────
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth:         (req: any) => ({ userId: req.headers['x-test-user-id'] ?? null }),
}));

vi.mock('@clerk/shared/keys', () => ({
  publishableKeyFromHost: () => 'pk_test_placeholder_xxxxxxxxxxxxxxxx',
}));

import app from '../app';
import {
  db, pool,
  characterTable,
  journalEntriesTable,
  storiesTable,
  outfitsTable,
  userRewardsTable,
  rewardEventsTable,
  constellationProgressTable,
} from '@workspace/db';

// ── Unique test identities per run to avoid cross-run collisions ──────────────
const RUN  = Date.now().toString(36);
const UID_A = `tgn_a_${RUN}`;
const UID_B = `tgn_b_${RUN}`;

// ── Request helpers ───────────────────────────────────────────────────────────

/** Authenticated request as a specific user */
const as = (uid: string) => ({
  get:    (path: string) => supertest(app).get(`/api${path}`).set('x-test-user-id', uid),
  post:   (path: string) => supertest(app).post(`/api${path}`).set('x-test-user-id', uid),
  patch:  (path: string) => supertest(app).patch(`/api${path}`).set('x-test-user-id', uid),
  delete: (path: string) => supertest(app).delete(`/api${path}`).set('x-test-user-id', uid),
});

/** Unauthenticated request (no header) */
const anon = {
  get:    (path: string) => supertest(app).get(`/api${path}`),
  post:   (path: string) => supertest(app).post(`/api${path}`),
  patch:  (path: string) => supertest(app).patch(`/api${path}`),
  delete: (path: string) => supertest(app).delete(`/api${path}`),
};

// ── Seed data fixtures ────────────────────────────────────────────────────────
const newStory = (overrides?: Record<string, unknown>) => ({
  date:         new Date().toISOString(),
  chapterTitle: 'The Wanderer Awakes',
  panels:       [{ id: 'p1', text: 'A voice drifts through the clouds' }],
  mood:         'Hopeful',
  isPublic:     false,
  ...overrides,
});

const newJournal = (overrides?: Record<string, unknown>) => ({
  date: new Date().toISOString(),
  type: 'diary',
  text: 'A quiet moment in the sky',
  mood: 'Peaceful',
  ...overrides,
});

const newOutfit = (overrides?: Record<string, unknown>) => ({
  date:        new Date().toISOString(),
  name:        'Sky Robe',
  description: 'Worn by every wanderer',
  tags:        ['soft', 'minimal'],
  isPublic:    false,
  ...overrides,
});

// ── Global test setup/teardown ────────────────────────────────────────────────
beforeAll(async () => {
  await db.insert(characterTable).values([
    { userId: UID_A, name: 'Guardian A', isPublic: true,  isBanned: false, mood: 'Hopeful'  },
    { userId: UID_B, name: 'Guardian B', isPublic: true,  isBanned: false, mood: 'Peaceful' },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  const users = [UID_A, UID_B];
  try {
    await Promise.all([
      db.delete(journalEntriesTable).where(inArray(journalEntriesTable.userId, users)),
      db.delete(storiesTable).where(inArray(storiesTable.userId, users)),
      db.delete(outfitsTable).where(inArray(outfitsTable.userId, users)),
      db.delete(rewardEventsTable).where(inArray(rewardEventsTable.userId, users)),
      db.delete(userRewardsTable).where(inArray(userRewardsTable.userId, users)),
      db.delete(constellationProgressTable).where(inArray(constellationProgressTable.userId, users)),
    ]);
    await db.delete(characterTable).where(inArray(characterTable.userId, users));
  } finally {
    await pool.end();
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. AUTH MIDDLEWARE — unauthenticated requests must return 401
// ════════════════════════════════════════════════════════════════════════════════
describe('Auth middleware — 401 without valid JWT', () => {
  it('GET /journal-entries returns 401', async () => {
    const res = await anon.get('/journal-entries');
    expect(res.status).toBe(401);
  });

  it('POST /journal-entries returns 401', async () => {
    const res = await anon.post('/journal-entries').send(newJournal());
    expect(res.status).toBe(401);
  });

  it('DELETE /journal-entries/:id returns 401', async () => {
    const res = await anon.delete('/journal-entries/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
  });

  it('GET /stories returns 401', async () => {
    const res = await anon.get('/stories');
    expect(res.status).toBe(401);
  });

  it('POST /stories returns 401', async () => {
    const res = await anon.post('/stories').send(newStory());
    expect(res.status).toBe(401);
  });

  it('GET /stories/:id returns 401', async () => {
    const res = await anon.get('/stories/00000000-0000-0000-0000-000000000002');
    expect(res.status).toBe(401);
  });

  it('DELETE /stories/:id returns 401', async () => {
    const res = await anon.delete('/stories/00000000-0000-0000-0000-000000000002');
    expect(res.status).toBe(401);
  });

  it('GET /outfits returns 401', async () => {
    const res = await anon.get('/outfits');
    expect(res.status).toBe(401);
  });

  it('POST /outfits returns 401', async () => {
    const res = await anon.post('/outfits').send(newOutfit());
    expect(res.status).toBe(401);
  });

  it('GET /discover returns 401', async () => {
    const res = await anon.get('/discover');
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. USER ISOLATION — User A cannot read or modify User B's data
// ════════════════════════════════════════════════════════════════════════════════
describe('User isolation — cross-user access is blocked', () => {
  let bJournalId: string;
  let bStoryId:   string;
  let bOutfitId:  string;

  beforeAll(async () => {
    // Seed User B's private data directly via DB to avoid test coupling
    const [je] = await db.insert(journalEntriesTable).values({
      userId: UID_B,
      date:   new Date(),
      type:   'diary',
      text:   'B private entry',
      mood:   'Peaceful',
    }).returning();
    bJournalId = je.id;

    const [st] = await db.insert(storiesTable).values({
      userId:       UID_B,
      date:         new Date(),
      chapterTitle: 'B private story',
      panels:       [{ id: 'px', text: 'hidden' }],
      mood:         'Lonely',
      location:     '',
      isPublic:     false,
    }).returning();
    bStoryId = st.id;

    const [ot] = await db.insert(outfitsTable).values({
      userId:      UID_B,
      date:        new Date(),
      name:        'B private outfit',
      description: '',
      tags:        [],
      isPublic:    false,
    }).returning();
    bOutfitId = ot.id;
  });

  it('User A lists journal entries and does NOT see User B\'s entries', async () => {
    const res = await as(UID_A).get('/journal-entries');
    expect(res.status).toBe(200);
    const ids = (res.body as any[]).map((e: any) => e.id);
    expect(ids).not.toContain(bJournalId);
  });

  it('User A deletes User B\'s journal entry — entry still exists afterward', async () => {
    const res = await as(UID_A).delete(`/journal-entries/${bJournalId}`);
    expect(res.status).toBe(204);
    const rows = await db.select().from(journalEntriesTable)
      .where(inArray(journalEntriesTable.id, [bJournalId as any]));
    expect(rows).toHaveLength(1);
  });

  it('User A lists stories and does NOT see User B\'s stories', async () => {
    const res = await as(UID_A).get('/stories');
    expect(res.status).toBe(200);
    const ids = (res.body as any[]).map((s: any) => s.id);
    expect(ids).not.toContain(bStoryId);
  });

  it('User A deletes User B\'s story — story still exists afterward', async () => {
    const res = await as(UID_A).delete(`/stories/${bStoryId}`);
    expect(res.status).toBe(204);
    const rows = await db.select().from(storiesTable)
      .where(inArray(storiesTable.id, [bStoryId as any]));
    expect(rows).toHaveLength(1);
  });

  it('User A fetches User B\'s private story by ID → 404', async () => {
    const res = await as(UID_A).get(`/stories/${bStoryId}`);
    expect(res.status).toBe(404);
  });

  it('User A lists outfits and does NOT see User B\'s outfits', async () => {
    const res = await as(UID_A).get('/outfits');
    expect(res.status).toBe(200);
    const ids = (res.body as any[]).map((o: any) => o.id);
    expect(ids).not.toContain(bOutfitId);
  });

  it('User A deletes User B\'s outfit — outfit still exists afterward', async () => {
    const res = await as(UID_A).delete(`/outfits/${bOutfitId}`);
    expect(res.status).toBe(204);
    const rows = await db.select().from(outfitsTable)
      .where(inArray(outfitsTable.id, [bOutfitId as any]));
    expect(rows).toHaveLength(1);
  });

  it('User A patches User B\'s outfit → 404', async () => {
    const res = await as(UID_A).patch(`/outfits/${bOutfitId}`).send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 3. STORY CRUD — create / retrieve / update / delete round-trip
// ════════════════════════════════════════════════════════════════════════════════
describe('Story CRUD — full lifecycle', () => {
  let createdId: string;

  it('POST /stories with valid data → 201 with id, chapterTitle, mood, isPublic, witnessedCount', async () => {
    const res = await as(UID_A).post('/stories').send(newStory({ isPublic: false, mood: 'Dreamy' }));
    expect(res.status).toBe(201);
    const body = res.body as any;
    expect(body.id).toBeTruthy();
    expect(body.chapterTitle).toBe('The Wanderer Awakes');
    expect(body.mood).toBe('Dreamy');
    expect(body.isPublic).toBe(false);
    expect(body.witnessedCount).toBe(0);
    createdId = body.id;
  });

  it('POST /stories with missing chapterTitle → 400', async () => {
    const res = await as(UID_A).post('/stories').send({
      date:   new Date().toISOString(),
      panels: [{ id: 'p1', text: 'x' }],
      mood:   'Soft',
    });
    expect(res.status).toBe(400);
  });

  it('GET /stories/:id returns the created story with correct fields', async () => {
    const res = await as(UID_A).get(`/stories/${createdId}`);
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.id).toBe(createdId);
    expect(body.chapterTitle).toBe('The Wanderer Awakes');
    expect(body.mood).toBe('Dreamy');
    expect(body.isPublic).toBe(false);
    expect(Array.isArray(body.panels)).toBe(true);
    expect(body.panels[0].text).toBe('A voice drifts through the clouds');
  });

  it('GET /stories/:id for non-existent ID → 404', async () => {
    const res = await as(UID_A).get('/stories/00000000-0000-0000-0000-deadbeef0000');
    expect(res.status).toBe(404);
  });

  it('GET /stories returns an array that includes the created story', async () => {
    const res = await as(UID_A).get('/stories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = (res.body as any[]).map((s: any) => s.id);
    expect(ids).toContain(createdId);
  });

  it('PATCH /stories/:id updates chapterTitle → 200 with updated value', async () => {
    const res = await as(UID_A)
      .patch(`/stories/${createdId}`)
      .send({ chapterTitle: 'Revised Chapter Title' });
    expect(res.status).toBe(200);
    expect((res.body as any).chapterTitle).toBe('Revised Chapter Title');
  });

  it('DELETE /stories/:id → 204', async () => {
    const res = await as(UID_A).delete(`/stories/${createdId}`);
    expect(res.status).toBe(204);
  });

  it('GET /stories/:id after delete → 404', async () => {
    const res = await as(UID_A).get(`/stories/${createdId}`);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 4. DISCOVER FEED — own stories excluded, scoring fields respected
// ════════════════════════════════════════════════════════════════════════════════
describe('Discover feed — exclusion and field integrity', () => {
  let ownStoryId:     string;
  let publicBStoryId: string;

  beforeAll(async () => {
    // User A's own public story — must NOT appear in A's feed
    const resA = await as(UID_A).post('/stories').send(newStory({ isPublic: true, chapterTitle: 'A public story' }));
    ownStoryId = resA.body.id;

    // User B's public story — MUST appear in A's feed
    const resB = await as(UID_B).post('/stories').send(newStory({ isPublic: true, chapterTitle: 'B public story' }));
    publicBStoryId = resB.body.id;
  });

  it('GET /discover returns 200 with an array', async () => {
    const res = await as(UID_A).get('/discover');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Discover feed does NOT include the requesting user\'s own stories', async () => {
    const res = await as(UID_A).get('/discover');
    expect(res.status).toBe(200);
    const ids = (res.body as any[]).map((p: any) => p.id);
    expect(ids).not.toContain(ownStoryId);
  });

  it('Discover feed includes User B\'s public story for User A', async () => {
    const res = await as(UID_A).get('/discover');
    expect(res.status).toBe(200);
    const ids = (res.body as any[]).map((p: any) => p.id);
    expect(ids).toContain(publicBStoryId);
  });

  it('Discover feed does NOT include User B\'s private story', async () => {
    // Seed a private story for B
    const [privateStory] = await db.insert(storiesTable).values({
      userId:       UID_B,
      date:         new Date(),
      chapterTitle: 'B private (discover test)',
      panels:       [{ id: 'pp', text: 'shh' }],
      mood:         'Lonely',
      location:     '',
      isPublic:     false,
    }).returning();

    const res = await as(UID_A).get('/discover');
    const ids = (res.body as any[]).map((p: any) => p.id);
    expect(ids).not.toContain(privateStory.id);
  });

  it('Each discover item has required response fields', async () => {
    const res = await as(UID_A).get('/discover');
    expect(res.status).toBe(200);
    const posts = res.body as any[];
    expect(posts.length).toBeGreaterThan(0);
    const post = posts.find((p: any) => p.id === publicBStoryId);
    expect(post).toBeDefined();
    expect(post.authorUserId).toBe(UID_B);
    expect(post.authorName).toBe('Guardian B');
    expect(post.chapterTitle).toBe('B public story');
    expect(typeof post.mood).toBe('string');
    expect(typeof post.witnessedCount).toBe('number');
    expect(Array.isArray(post.panels)).toBe(true);
  });

  it('Discover feed for User B also excludes B\'s own stories', async () => {
    const res = await as(UID_B).get('/discover');
    expect(res.status).toBe(200);
    const ids = (res.body as any[]).map((p: any) => p.id);
    expect(ids).not.toContain(publicBStoryId);
  });
});
