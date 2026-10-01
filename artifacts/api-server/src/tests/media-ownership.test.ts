import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, runStartupMigrations, journalEntriesTable, outfitsTable, storiesTable, uploadedImagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { setTestUserId } from "./helpers/testApp";
import journalEntriesRouter from "../routes/journal-entries";
import galleryRouter from "../routes/gallery";
import outfitsRouter from "../routes/outfits";
import storiesRouter from "../routes/stories";
import { signOwnerMediaUrl, validateOwnerMediaTicket } from "../lib/mediaAccess";

const app = express();
app.use(express.json());
app.use("/api", journalEntriesRouter);
app.use("/api", galleryRouter);
app.use("/api", outfitsRouter);
app.use("/api", storiesRouter);

const OWNER = "media-ownership-owner";
const ATTACKER = "media-ownership-attacker";
const JOURNAL_ID = "1056b7d8-214a-4c70-91c2-3048974d9a01";
const OUTFIT_ID = "2056b7d8-214a-4c70-91c2-3048974d9a01";
const FOREIGN_MEDIA_PATH = "/api/images/foreign-ticket-photo.jpg";

beforeAll(async () => {
  await runStartupMigrations();
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, JOURNAL_ID));
  await db.delete(outfitsTable).where(eq(outfitsTable.id, OUTFIT_ID));
  await db.insert(journalEntriesTable).values({
    id: JOURNAL_ID, userId: OWNER, type: "diary", text: "Owner journal",
    mood: "Calm", date: new Date("2024-01-01T00:00:00Z"),
  });
  await db.insert(outfitsTable).values({
    id: OUTFIT_ID, userId: OWNER, name: "Owner outfit",
    date: new Date("2024-01-01T00:00:00Z"),
  });
  await db.delete(uploadedImagesTable).where(eq(uploadedImagesTable.path, FOREIGN_MEDIA_PATH));
  await db.insert(uploadedImagesTable).values({
    path: FOREIGN_MEDIA_PATH, userId: OWNER, byteSize: 3,
  });
});

afterAll(async () => {
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, JOURNAL_ID));
  await db.delete(outfitsTable).where(eq(outfitsTable.id, OUTFIT_ID));
  await db.delete(uploadedImagesTable).where(eq(uploadedImagesTable.path, FOREIGN_MEDIA_PATH));
});

describe("record ownership and managed media", () => {
  it("does not let an idempotent journal create take over another user's row", async () => {
    setTestUserId(ATTACKER);
    const response = await request(app).post("/api/journal-entries").send({
      id: JOURNAL_ID,
      date: "2025-01-01T00:00:00Z",
      type: "diary",
      text: "Takeover attempt",
      mood: "Angry",
    });
    expect(response.status).toBe(404);
    const [stored] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, JOURNAL_ID));
    expect(stored).toMatchObject({ userId: OWNER, text: "Owner journal" });
  });

  it("does not let an idempotent outfit create take over another user's row", async () => {
    setTestUserId(ATTACKER);
    const response = await request(app).post("/api/outfits").send({
      id: OUTFIT_ID,
      date: "2025-01-01T00:00:00Z",
      name: "Takeover attempt",
      isPublic: true,
    });
    expect(response.status).toBe(404);
    const [stored] = await db.select().from(outfitsTable).where(eq(outfitsTable.id, OUTFIT_ID));
    expect(stored).toMatchObject({ userId: OWNER, name: "Owner outfit" });
  });

  it("rejects managed media that is not owned by the authenticated user", async () => {
    setTestUserId(ATTACKER);
    const response = await request(app).post("/api/gallery").send({
      imageUri: "/api/images/private-asset-owned-by-someone-else.jpg",
      caption: "Not mine",
    });
    expect(response.status).toBe(403);
  });

  it("rejects foreign media aliases carrying an owner's ticket on the actual write route", async () => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "media-ownership-alias-test-secret";
    try {
      const ticket = new URL(signOwnerMediaUrl(FOREIGN_MEDIA_PATH, OWNER), "http://test")
        .searchParams.get("ticket")!;
      setTestUserId(ATTACKER);
      for (const imageUri of [
        `/api/images/%66oreign-ticket-photo.jpg?ticket=${ticket}`,
        `/api/images/foreign-ticket-photo.jpg/?ticket=${ticket}`,
        `/API/IMAGES/foreign-ticket-photo.jpg?ticket=${ticket}`,
        `/api/images/../images/foreign-ticket-photo.jpg?ticket=${ticket}`,
      ]) {
        const response = await request(app).post("/api/gallery").send({
          imageUri,
          caption: "Foreign ticket",
        });
        expect(response.status).toBe(403);
      }
    } finally {
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
    }
  });

  it("rejects managed media music streams on story and outfit create/update while allowing Audius", async () => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "media-ownership-music-test-secret";
    let storyId: string | undefined;
    let outfitId: string | undefined;
    try {
      const managedStreams = [
        (() => {
          const path = "/api/videos/foreign-music-track.mp4";
          const ticket = new URL(signOwnerMediaUrl(path, OWNER), "https://ticket.invalid")
            .searchParams.get("ticket")!;
          expect(validateOwnerMediaTicket(ticket, path)).toBe(OWNER);
          return `https://media.example${path}?ticket=${encodeURIComponent(ticket)}`;
        })(),
        (() => {
          const path = "/api/images/foreign-music-cover.png";
          const ticket = new URL(signOwnerMediaUrl(path, OWNER), "https://ticket.invalid")
            .searchParams.get("ticket")!;
          expect(validateOwnerMediaTicket(ticket, path)).toBe(OWNER);
          return `https://media.example/API/IMAGES/%66oreign-music-cover.png/?ticket=${encodeURIComponent(ticket)}`;
        })(),
      ];
      const makeMusic = (streamUrl: string) => ({
        id: "audius-track",
        title: "Audius track",
        artist: "Audius artist",
        artworkUrl: null,
        duration: 42,
        genre: null,
        mood: null,
        streamUrl,
      });
      const audiusCreateStream = "https://discoveryprovider.audius.co/v1/tracks/create-track/stream?app_name=Storigam";
      const audiusUpdateStream = "https://discoveryprovider.audius.co/v1/tracks/update-track/stream?app_name=Storigam";
      setTestUserId(ATTACKER);

      for (const streamUrl of managedStreams) {
        const outfitResponse = await request(app).post("/api/outfits").send({
          date: "2025-01-01T00:00:00Z",
          name: "Rejected music outfit",
          music: makeMusic(streamUrl),
        });
        expect(outfitResponse.status).toBe(400);

        const storyResponse = await request(app).post("/api/stories").send({
          date: "2025-01-01T00:00:00Z",
          chapterTitle: "Rejected music story",
          panels: [{ id: "panel-1", text: "A story panel" }],
          music: makeMusic(streamUrl),
        });
        expect(storyResponse.status).toBe(400);
      }

      const outfitCreate = await request(app).post("/api/outfits").send({
        date: "2025-01-01T00:00:00Z",
        name: "Audius music outfit",
        music: makeMusic(audiusCreateStream),
      });
      expect(outfitCreate.status).toBe(201);
      outfitId = outfitCreate.body.id as string;

      const storyCreate = await request(app).post("/api/stories").send({
        date: "2025-01-01T00:00:00Z",
        chapterTitle: "Audius music story",
        panels: [{ id: "panel-1", text: "A story panel" }],
        music: makeMusic(audiusCreateStream),
      });
      expect(storyCreate.status).toBe(201);
      storyId = storyCreate.body.id as string;

      for (const streamUrl of managedStreams) {
        expect((await request(app).patch(`/api/outfits/${outfitId}`).send({ music: makeMusic(streamUrl) })).status).toBe(400);
        expect((await request(app).patch(`/api/stories/${storyId}`).send({ music: makeMusic(streamUrl) })).status).toBe(400);
      }

      expect((await request(app).patch(`/api/outfits/${outfitId}`).send({ music: makeMusic(audiusUpdateStream) })).status).toBe(200);
      expect((await request(app).patch(`/api/stories/${storyId}`).send({ music: makeMusic(audiusUpdateStream) })).status).toBe(200);

      const [storedOutfit] = await db.select().from(outfitsTable).where(eq(outfitsTable.id, outfitId));
      const [storedStory] = await db.select().from(storiesTable).where(eq(storiesTable.id, storyId));
      expect(storedOutfit.music).toMatchObject({ streamUrl: audiusUpdateStream });
      expect(storedStory.music).toMatchObject({ streamUrl: audiusUpdateStream });
    } finally {
      if (storyId) await db.delete(storiesTable).where(eq(storiesTable.id, storyId));
      if (outfitId) await db.delete(outfitsTable).where(eq(outfitsTable.id, outfitId));
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
    }
  });
});