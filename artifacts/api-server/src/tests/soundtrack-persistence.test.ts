import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { db, characterTable, outfitsTable, storiesTable, mediaCompositionsTable, uploadedImagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import outfitsRouter from "../routes/outfits";

// Real HTTP routes + development DB, with authentication and unrelated fan-out
// services supplied by the standard test app. Never touch existing users' rows.
const owner = `test-soundtracks-${randomUUID()}`;
const outsider = `test-soundtracks-outsider-${randomUUID()}`;
const app = createTestApp();
app.use("/api", outfitsRouter);
const track = {
  id: "soundtrack-a", title: "Quiet stars", artist: "Test artist",
  artworkUrl: null, duration: 180, genre: "Ambient", mood: "Peaceful",
  streamUrl: "https://discovery.example.test/v1/tracks/a/stream",
};

beforeAll(async () => {
  await db.insert(characterTable).values([
    { userId: owner, name: "Soundtrack test", isPublic: true },
    { userId: outsider, name: "Soundtrack outsider", isPublic: true },
  ]);
});

afterAll(async () => {
  await db.delete(outfitsTable).where(eq(outfitsTable.userId, owner));
  await db.delete(storiesTable).where(eq(storiesTable.userId, owner));
  await db.delete(mediaCompositionsTable).where(eq(mediaCompositionsTable.userId, owner));
  await db.delete(uploadedImagesTable).where(eq(uploadedImagesTable.userId, owner));
  await db.delete(characterTable).where(eq(characterTable.userId, owner));
  await db.delete(characterTable).where(eq(characterTable.userId, outsider));
});

describe("soundtrack HTTP and database round trips", () => {
  it("persists embedded video music through the composition claim and replayed publish", async () => {
    setTestUserId(owner);
    const id = randomUUID(), compositionId = randomUUID();
    const videoPath = `/api/images/test-soundtrack-${compositionId}.mp4`;
    const thumbnailPath = `/api/images/test-soundtrack-${compositionId}.jpg`;
    await db.insert(uploadedImagesTable).values([
      { userId: owner, path: videoPath, byteSize: 1 },
      { userId: owner, path: thumbnailPath, byteSize: 1 },
    ]);
    await db.insert(mediaCompositionsTable).values({
      id: compositionId, userId: owner, videoPath, thumbnailPath,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const embedded = {
      ...track, embedded: true, segmentStartSeconds: 10, segmentDurationSeconds: 20,
      originalVolume: 0.2, musicVolume: 0.7,
    };
    const payload = {
      id, chapterTitle: "Video with music", mood: "Creative",
      date: new Date().toISOString(), isPublic: false,
      panels: [], contentType: "video", compositionId, music: embedded,
    };
    const created = await request(app).post("/api/stories").send(payload);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.music).toEqual(embedded);
    const repeated = await request(app).post("/api/stories").send(payload);
    expect(repeated.status).toBe(200);
    expect(repeated.body.music).toEqual(embedded);
    const listed = await request(app).get("/api/stories");
    expect(listed.body.find((s: { id: string }) => s.id === id).music).toEqual(embedded);
    const [stored] = await db.select().from(storiesTable).where(eq(storiesTable.id, id));
    expect(stored.music).toEqual(embedded);
    const [claim] = await db.select().from(mediaCompositionsTable).where(eq(mediaCompositionsTable.id, compositionId));
    expect(claim.status).toBe("claimed");
  });

  it("preserves outfit music across create, list, edit, unrelated edit, and explicit removal", async () => {
    setTestUserId(owner);
    const id = randomUUID();
    const created = await request(app).post("/api/outfits").send({
      id, name: "Star cape", date: new Date().toISOString(),
      imageUri: null, music: track, isPublic: false,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.music).toEqual(track);
    const replacement = { ...track, id: "soundtrack-b", streamUrl: "https://discovery.example.test/v1/tracks/b/stream" };
    const edited = await request(app).patch(`/api/outfits/${id}`).send({ music: replacement });
    expect(edited.status).toBe(200);
    expect(edited.body.music).toEqual(replacement);
    const renamed = await request(app).patch(`/api/outfits/${id}`).send({ name: "Renamed cape" });
    expect(renamed.body.music).toEqual(replacement);
    const listed = await request(app).get("/api/outfits");
    expect(listed.body.find((o: { id: string }) => o.id === id).music).toEqual(replacement);
    const [stored] = await db.select().from(outfitsTable).where(eq(outfitsTable.id, id));
    expect(stored.music).toEqual(replacement);
    const removed = await request(app).patch(`/api/outfits/${id}`).send({ music: null });
    expect(removed.status).toBe(200);
    expect(removed.body.music).toBeNull();
    const reloaded = await request(app).get("/api/outfits");
    expect(reloaded.body.find((o: { id: string }) => o.id === id).music).toBeNull();
    const [cleared] = await db.select().from(outfitsTable).where(eq(outfitsTable.id, id));
    expect(cleared.music).toBeNull();
  });

  it("does not let another account replace an outfit soundtrack", async () => {
    const id = randomUUID();
    setTestUserId(owner);
    await request(app).post("/api/outfits").send({
      id, name: "Private cape", date: new Date().toISOString(), music: track,
    });
    setTestUserId(outsider);
    const response = await request(app).patch(`/api/outfits/${id}`).send({ music: null });
    expect(response.status).toBe(404);
    const [stored] = await db.select().from(outfitsTable).where(eq(outfitsTable.id, id));
    expect(stored.music).toEqual(track);
  });

  it("preserves an AI manga soundtrack when a saved story is published, then removes it explicitly", async () => {
    setTestUserId(owner);
    const id = randomUUID();
    const created = await request(app).post("/api/stories").send({
      id, chapterTitle: "A manga journey", mood: "Creative",
      date: new Date().toISOString(), isPublic: false,
      panels: [{ id: "panel", text: "A memory", imageUri: null }], music: track,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.music).toEqual(track);
    const posted = await request(app).patch(`/api/stories/${id}`).send({ isPublic: true, music: track });
    expect(posted.status).toBe(200);
    expect(posted.body.music).toEqual(track);
    const [stored] = await db.select().from(storiesTable).where(eq(storiesTable.id, id));
    expect(stored.music).toEqual(track);
    await request(app).patch(`/api/stories/${id}`).send({ music: null });
    const listed = await request(app).get("/api/stories");
    expect(listed.body.find((s: { id: string }) => s.id === id).music).toBeNull();
  });
});
