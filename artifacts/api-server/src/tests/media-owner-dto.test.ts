import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ pool: { query: vi.fn() } }));
vi.mock("../lib/objectStorage", () => ({ objectStorageClient: {} }));

import { validateOwnerMediaTicket, withOwnerMediaUrls } from "../lib/mediaAccess";

afterEach(() => vi.unstubAllEnvs());

describe("owner media response serialization", () => {
  it("signs only media fields, preserving authored text and nested structure", () => {
    vi.stubEnv("SESSION_SECRET", "privacy-dto-test-secret");
    const path = "/api/images/private-photo.jpg";
    const createdAt = new Date("2026-10-01T00:00:00Z");
    const input = {
      text: path,
      caption: path,
      imageUri: `${path}?ticket=old`,
      createdAt,
      pages: [{ panels: [{ imageUri: path, caption: path }] }],
      music: { artworkUrl: path, title: path },
      external: { imageUri: "https://example.com/photo.jpg" },
    };
    const output = withOwnerMediaUrls(input, "owner");
    expect(output.text).toBe(path);
    expect(output.caption).toBe(path);
    expect(output.createdAt).toBe(createdAt);
    expect(output.pages[0].panels[0].caption).toBe(path);
    expect(output.music.title).toBe(path);
    expect(output.external.imageUri).toBe(input.external.imageUri);
    for (const uri of [output.imageUri, output.pages[0].panels[0].imageUri, output.music.artworkUrl]) {
      const ticket = new URL(uri, "https://test.invalid").searchParams.get("ticket");
      expect(validateOwnerMediaTicket(ticket, path)).toBe("owner");
    }
    expect(input.imageUri).toBe(`${path}?ticket=old`);
  });
});