import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("public outfit comments navigation", () => {
  it("passes the selected outfit identity and title to the shared comments screen", () => {
    const outfitDetail = read("user-outfit.tsx");

    expect(outfitDetail).toMatch(/pathname:\s*['"]\/content-comments['"]/);
    expect(outfitDetail).toMatch(/contentType:\s*['"]outfit['"]/);
    expect(outfitDetail).toMatch(/contentId:\s*outfit\.id/);
    expect(outfitDetail).toMatch(/title:\s*outfit\.name/);
  });

  it("uses the route outfit context to fetch and submit comments", () => {
    const commentsScreen = read("content-comments.tsx");

    expect(commentsScreen).toContain("useGetContentComments(contentType ?? \"story\", contentId");
    expect(commentsScreen).toMatch(/createComment\.mutate\(\{\s*contentType,\s*contentId,\s*data:/);
  });
});
