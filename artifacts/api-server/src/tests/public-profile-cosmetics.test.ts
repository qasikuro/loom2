import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  db,
  runStartupMigrations,
  characterTable,
  userPurchasesTable,
  userRewardsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import rewardsRouter from "../routes/rewards";

const app = createTestApp();
app.use("/api", rewardsRouter);
const VIEWER = "test-profile-cosmetics-viewer";
const OWNER = "test-profile-cosmetics-owner";
const NON_OWNER = "test-profile-cosmetics-non-owner";

let shopEffects: { id: string; name: string }[] = [];
let shopFrames: { id: string; name: string }[] = [];

beforeAll(async () => {
  await runStartupMigrations();
  const { SHOP_CATALOG } = await import("../routes/rewards");
  shopEffects = SHOP_CATALOG.filter(item => item.category === "effect");
  shopFrames = SHOP_CATALOG.filter(item => item.category === "frame");
  await db.insert(characterTable).values([
    { userId: VIEWER, name: "Cosmetic viewer", isPublic: true, isBanned: false },
    { userId: OWNER, name: "Cosmetic owner", isPublic: true, isBanned: false },
    { userId: NON_OWNER, name: "Non-owner", isPublic: true, isBanned: false },
  ]).onConflictDoNothing();

  await db.insert(userPurchasesTable).values(
    [...shopEffects, ...shopFrames].map(item => ({
      userId: OWNER,
      itemId: item.id,
      itemName: item.name,
      starsSpent: 0,
    })),
  ).onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(userRewardsTable).where(eq(userRewardsTable.userId, OWNER));
  await db.delete(userPurchasesTable).where(eq(userPurchasesTable.userId, OWNER));
  await db.delete(userPurchasesTable).where(eq(userPurchasesTable.userId, NON_OWNER));
  await db.delete(userRewardsTable).where(eq(userRewardsTable.userId, NON_OWNER));
  await db.delete(characterTable).where(inArray(characterTable.userId, [VIEWER, OWNER, NON_OWNER]));
});

describe("public profile shop effects", () => {
  it("returns every equipped shop effect when its owner has purchased it", async () => {
    setTestUserId(VIEWER);

    for (const item of shopEffects) {
      await db.insert(userRewardsTable)
        .values({ userId: OWNER, activeCosmetics: { effect: item.id } })
        .onConflictDoUpdate({
          target: userRewardsTable.userId,
          set: { activeCosmetics: { effect: item.id } },
        });

      const response = await request(app).get(`/api/users/${OWNER}`);
      expect(response.status, item.id).toBe(200);
      expect(response.body.activeEffect, item.id).toBe(item.id);
    }
  });

  it("does not expose an effect when the profile owner does not own it", async () => {
    setTestUserId(VIEWER);
    await db.insert(userRewardsTable)
      .values({ userId: NON_OWNER, activeCosmetics: { effect: "effect_butterfly" } })
      .onConflictDoUpdate({
        target: userRewardsTable.userId,
        set: { activeCosmetics: { effect: "effect_butterfly" } },
      });

    const response = await request(app).get(`/api/users/${NON_OWNER}`);
    expect(response.status).toBe(200);
    expect(response.body.activeEffect).toBeNull();
  });

  it("lets an owner equip each purchased shop frame and shows it to profile visitors", async () => {
    const animalEarIds = [
      "frame_ember_fox_ears",
      "frame_moonhare_ears",
      "frame_frost_lynx_ears",
    ];
    const companionIds = [
      "frame_baby_dragon",
      "frame_moon_bunny",
      "frame_shadow_keeper",
      "frame_forest_spirit",
      "frame_star_guardian",
    ];
    expect(shopFrames.filter(item => animalEarIds.includes(item.id)).map(item => item.id).sort())
      .toEqual([...animalEarIds].sort());
    expect(shopFrames.filter(item => companionIds.includes(item.id)).map(item => item.id).sort())
      .toEqual([...companionIds].sort());

    setTestUserId(OWNER);
    const catalogResponse = await request(app).get("/api/rewards/shop");
    expect(catalogResponse.status).toBe(200);
    expect(catalogResponse.body.catalog.map((item: { id: string }) => item.id))
      .toEqual(expect.arrayContaining([...animalEarIds, ...companionIds]));

    for (const item of shopFrames) {
      setTestUserId(OWNER);
      const equipResponse = await request(app)
        .put("/api/rewards/active-cosmetics")
        .send({ activeCosmetics: { frame: item.id } });
      expect(equipResponse.status, item.id).toBe(200);

      setTestUserId(VIEWER);
      const response = await request(app).get(`/api/users/${OWNER}`);
      expect(response.status, item.id).toBe(200);
      expect(response.body.activeFrame, item.id).toBe(item.id);
    }
  });

  it("does not expose an animal ear frame when the profile owner does not own it", async () => {
    setTestUserId(VIEWER);
    await db.insert(userRewardsTable)
      .values({ userId: NON_OWNER, activeCosmetics: { frame: "frame_ember_fox_ears" } })
      .onConflictDoUpdate({
        target: userRewardsTable.userId,
        set: { activeCosmetics: { frame: "frame_ember_fox_ears" } },
      });

    const response = await request(app).get(`/api/users/${NON_OWNER}`);
    expect(response.status).toBe(200);
    expect(response.body.activeFrame).toBeNull();
  });

  it("lets a user claim Cosmic Arrival for free, equip it, and expose it to profile visitors", async () => {
    const { SHOP_CATALOG } = await import("../routes/rewards");
    const item = SHOP_CATALOG.find(candidate => candidate.id === "effect_cosmic_arrival");
    expect(item).toMatchObject({ category: "effect", cost: { stars: 0 } });
    if (!item) throw new Error("Cosmic Arrival is missing from the shop catalog");

    setTestUserId(NON_OWNER);
    const claim = await request(app).post("/api/rewards/spend").send({ itemId: item.id });
    expect(claim.status).toBe(200);
    expect(claim.body).toMatchObject({ success: true, newBalance: { stars: 0 } });

    const shop = await request(app).get("/api/rewards/shop");
    expect(shop.status).toBe(200);
    expect(shop.body.purchasedIds).toContain(item.id);

    const equip = await request(app).put("/api/rewards/active-cosmetics")
      .send({ activeCosmetics: { effect: item.id } });
    expect(equip.status).toBe(200);

    setTestUserId(VIEWER);
    const profile = await request(app).get(`/api/users/${NON_OWNER}`);
    expect(profile.status).toBe(200);
    expect(profile.body.activeEffect).toBe(item.id);
  });
});
