import { afterAll, beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import { db, characterTable, userRewardsTable, userPurchasesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { founderCardFrame, FOUNDER_REGALIA_ID } from "../services/founderRegalia";
import { createTestApp, setTestUserId } from "./helpers/testApp";
import rewardsRouter from "../routes/rewards";

describe("Founder card-frame entitlement", () => {
  it("preserves the default frame for existing Founders", () => {
    expect(founderCardFrame(true, undefined)).toBe(FOUNDER_REGALIA_ID);
  });
  it("supports equipping and explicitly removing the frame", () => {
    expect(founderCardFrame(true, FOUNDER_REGALIA_ID)).toBe(FOUNDER_REGALIA_ID);
    expect(founderCardFrame(true, "")).toBeNull();
    expect(founderCardFrame(true, null)).toBeNull();
  });
  it("does not let non-Founders use a forged selection", () => {
    expect(founderCardFrame(false, FOUNDER_REGALIA_ID)).toBeNull();
    expect(founderCardFrame(false, undefined)).toBeNull();
  });
  it("rejects unknown saved values", () => {
    expect(founderCardFrame(true, "frame_celestial_wings")).toBeNull();
    expect(founderCardFrame(true, {})).toBeNull();
  });
});

const FOUNDER = "test-regalia-founder";
const MEMBER = "test-regalia-member";
const app = createTestApp();
app.use("/api", rewardsRouter);

beforeAll(async () => {
  await db.insert(characterTable).values([
    { userId: FOUNDER, name: "Regalia Founder", isPublic: true, isFounder: true },
    { userId: MEMBER, name: "Regalia Member", isPublic: true, isFounder: false },
  ]).onConflictDoNothing();
  await db.insert(userRewardsTable).values([
    { userId: FOUNDER, stars: 1000, activeCosmetics: { frame: "frame_celestial_wings", effect: "effect_aurora_clouds" } },
    { userId: MEMBER, stars: 1000 },
  ]).onConflictDoNothing();
  await db.insert(userPurchasesTable).values({
    userId: FOUNDER, itemId: "frame_celestial_wings", itemName: "Celestial Wings", starsSpent: 0,
  }).onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(userPurchasesTable).where(inArray(userPurchasesTable.userId, [FOUNDER, MEMBER]));
  await db.delete(userRewardsTable).where(inArray(userRewardsTable.userId, [FOUNDER, MEMBER]));
  await db.delete(characterTable).where(inArray(characterTable.userId, [FOUNDER, MEMBER]));
});

describe("Founder Regalia Store and public-profile flow", () => {
  it("includes the free owned border and default selection for Founders", async () => {
    setTestUserId(FOUNDER);
    const response = await request(app).get("/api/rewards/shop");
    expect(response.status).toBe(200);
    expect(response.body.catalog.find((item: { id: string }) => item.id === FOUNDER_REGALIA_ID))
      .toMatchObject({ category: "card_frame", founderOnly: true, cost: { stars: 0 } });
    expect(response.body.purchasedIds).toContain(FOUNDER_REGALIA_ID);
    expect(response.body.activeCosmetics.card_frame).toBe(FOUNDER_REGALIA_ID);
  });

  it("prevents non-Founders buying or equipping it without taking Stars", async () => {
    setTestUserId(MEMBER);
    const shop = await request(app).get("/api/rewards/shop");
    expect(shop.body.purchasedIds).not.toContain(FOUNDER_REGALIA_ID);
    const purchase = await request(app).post("/api/rewards/spend").send({ itemId: FOUNDER_REGALIA_ID });
    expect(purchase.status).toBe(403);
    const equip = await request(app).put("/api/rewards/active-cosmetics")
      .send({ activeCosmetics: { card_frame: FOUNDER_REGALIA_ID } });
    expect(equip.status).toBe(403);
    const [balance] = await db.select().from(userRewardsTable).where(eq(userRewardsTable.userId, MEMBER));
    expect(balance.stars).toBe(1000);
    const profile = await request(app).get(`/api/users/${MEMBER}`);
    expect(profile.body.activeCardFrame).toBeNull();
  });

  it("persists removal and equipping while retaining wings and the background", async () => {
    setTestUserId(FOUNDER);
    expect((await request(app).put("/api/rewards/active-cosmetics")
      .send({ activeCosmetics: { card_frame: "" } })).status).toBe(200);
    setTestUserId(MEMBER);
    expect((await request(app).get(`/api/users/${FOUNDER}`)).body.activeCardFrame).toBeNull();
    setTestUserId(FOUNDER);
    expect((await request(app).get("/api/rewards/shop")).body.activeCosmetics.card_frame).toBeUndefined();
    expect((await request(app).put("/api/rewards/active-cosmetics")
      .send({ activeCosmetics: { card_frame: FOUNDER_REGALIA_ID } })).status).toBe(200);
    setTestUserId(MEMBER);
    const profile = await request(app).get(`/api/users/${FOUNDER}`);
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({
      activeCardFrame: FOUNDER_REGALIA_ID,
      activeFrame: "frame_celestial_wings",
      activeEffect: "effect_aurora_clouds",
    });
  });

  it("never charges Founders twice or accepts the border in an avatar/effect slot", async () => {
    setTestUserId(FOUNDER);
    expect((await request(app).post("/api/rewards/spend")
      .send({ itemId: FOUNDER_REGALIA_ID })).status).toBe(409);
    expect((await request(app).put("/api/rewards/active-cosmetics")
      .send({ activeCosmetics: { effect: FOUNDER_REGALIA_ID } })).status).toBe(400);
    const [balance] = await db.select().from(userRewardsTable).where(eq(userRewardsTable.userId, FOUNDER));
    expect(balance.stars).toBe(1000);
  });
});
