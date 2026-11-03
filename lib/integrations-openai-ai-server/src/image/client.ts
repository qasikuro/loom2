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
  inputFidelity?: "low" | "high";
}

export interface ImageEditUsage {
  inputTokens: number;
  inputImageTokens: number;
  inputTextTokens: number;
  outputTokens: number;
}

export async function editImageBuffers(
  images: Array<{ buffer: Buffer; filename: string }>,
  prompt: string,
  options: ImageEditOptions = {},
): Promise<{ buffer: Buffer; usage: ImageEditUsage | null }> {
  const files = await Promise.all(
    images.map(({ buffer, filename }) => toFile(buffer, filename, { type: "image/jpeg" })),
  );
  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: files,
    prompt,
    quality: options.quality ?? "low",
    size: options.size ?? "1024x1024",
    input_fidelity: options.inputFidelity ?? "low",
  });
  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no image");
  const usage = response.usage;
  const tokenDetails = usage?.input_tokens_details;
  const hasCompleteUsage = Boolean(
    usage &&
    tokenDetails &&
    Number.isFinite(tokenDetails.image_tokens) &&
    Number.isFinite(tokenDetails.text_tokens),
  );
  return {
    buffer: Buffer.from(base64, "base64"),
    usage: hasCompleteUsage && usage && tokenDetails ? {
      inputTokens: usage.input_tokens,
      inputImageTokens: usage.input_tokens_details.image_tokens,
      inputTextTokens: tokenDetails.text_tokens,
      outputTokens: usage.output_tokens,
    } : null,
  };
}