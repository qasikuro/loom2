import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, getUserId } from "../middleware/auth";
import { requireAiAccess } from "../middleware/ai-access";
import { z } from "zod";

// ── Per-user rate limit ────────────────────────────────────────────────────────
// 10 AI requests per user per 60-second window (in-memory sliding window).
const _rlStore = new Map<string, number[]>();
const RL_WINDOW_MS = 60_000;
const RL_MAX       = 10;

function checkAiRateLimit(userId: string): { ok: boolean; retryAfter: number } {
  const now   = Date.now();
  const times = (_rlStore.get(userId) ?? []).filter(t => now - t < RL_WINDOW_MS);

  if (times.length >= RL_MAX) {
    const oldest     = times[0]!;
    const retryAfter = Math.ceil((oldest + RL_WINDOW_MS - now) / 1000);
    return { ok: false, retryAfter };
  }

  times.push(now);
  _rlStore.set(userId, times);
  return { ok: true, retryAfter: 0 };
}

const router = Router();

// Lazy-initialise so the server still boots if env vars are missing temporarily.
let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey:  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
  }
  return _anthropic;
}

const AI_TOOLS = [
  "continue",
  "dialogue",
  "scene",
  "grammar",
  "emotion",
  "cliffhanger",
  "translate",
] as const;
type AiTool = (typeof AI_TOOLS)[number];

const RequestSchema = z.object({
  tool:    z.enum(AI_TOOLS),
  context: z.string().max(4000),
});

function buildPrompt(tool: AiTool, context: string): string {
  const wrap = (instruction: string) =>
    `${instruction}\n\nText:\n"""\n${context}\n"""\n\nRespond with only the result — no preamble, no explanation, no surrounding quotes.`;

  switch (tool) {
    case "continue":
      return wrap(
        "You are a creative fiction writing assistant. Continue this story passage naturally, matching the existing tone, voice, and pacing. Write 2-4 sentences that flow seamlessly from the text above.",
      );
    case "dialogue":
      return wrap(
        "You are a creative writing assistant specialising in dialogue. Rewrite or improve the dialogue in this passage to feel more natural, distinctive, and emotionally resonant. Preserve all character names and the core meaning.",
      );
    case "scene":
      return wrap(
        "You are a creative writing assistant. Generate a vivid, sensory scene description (3-5 sentences) that could follow or expand on this passage. Focus on atmosphere, setting detail, and mood.",
      );
    case "grammar":
      return wrap(
        "You are a meticulous copy editor. Fix all grammar, spelling, punctuation, and awkward phrasing errors in the following text. Preserve the author's original style and voice exactly — only correct errors.",
      );
    case "emotion":
      return wrap(
        "You are a creative writing assistant. Rewrite this passage with deeper emotional resonance — show the character's inner feelings through action, sensation, and subtext rather than telling. Keep the same length.",
      );
    case "cliffhanger":
      return wrap(
        "You are a creative writing assistant. Rewrite the final sentence or paragraph of this passage to end on a compelling cliffhanger or moment of tension that will make the reader desperate to turn the page.",
      );
    case "translate":
      return wrap(
        "You are a skilled translator. If the text is in English, translate it to Spanish. If it is in any other language, translate it to English. Preserve the tone and style.",
      );
  }
}

/**
 * POST /ai/story-assist
 * Body: { tool: AiTool, context: string }
 * Returns: { text: string }
 */
router.post("/ai/story-assist", requireAuth, requireAiAccess, async (req, res) => {
  const userId = getUserId(req);

  const rl = checkAiRateLimit(userId);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    return res.status(429).json({ error: "Too many AI requests — please wait a moment before trying again" });
  }

  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { tool, context } = parsed.data;

  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
      !process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    return res.status(503).json({ error: "AI assistant is not configured" });
  }

  try {
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model:      "claude-haiku-4-5",   // fast, low-latency for inline editing
      max_tokens: 512,
      messages: [
        { role: "user", content: buildPrompt(tool, context) },
      ],
    });

    const block = message.content[0];
    const text  = block.type === "text" ? block.text.trim() : "";

    return res.json({ text });
  } catch (err) {
    req.log.error({ err }, "AI story-assist failed");
    return res.status(500).json({ error: "AI request failed — please try again" });
  }
});

export default router;
