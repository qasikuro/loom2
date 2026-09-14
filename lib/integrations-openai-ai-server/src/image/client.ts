import OpenAI, { toFile } from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL must be set");
}
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY must be set");
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ImageEditOptions {
  quality?: "low" | "medium" | "high" | "auto";
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
}

export async function editImageBuffers(
  images: Array<{ buffer: Buffer; filename: string }>,
  prompt: string,
  options: ImageEditOptions = {},
): Promise<Buffer> {
  const files = await Promise.all(
    images.map(({ buffer, filename }) => toFile(buffer, filename, { type: "image/jpeg" })),
  );
  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: files,
    prompt,
    quality: options.quality ?? "low",
    size: options.size ?? "1024x1024",
  });
  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no image");
  return Buffer.from(base64, "base64");
}