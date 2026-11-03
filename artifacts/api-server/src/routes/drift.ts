import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth";
import { requireAiAccess } from "../middleware/ai-access";
import { z } from "zod";

const router = Router();

const BodySchema = z.object({
  answers:       z.record(z.string().max(32), z.string().max(100)).refine(value => Object.keys(value).length <= 6),
  characterName: z.string().max(100).optional(),
  characterMood: z.string().max(100).optional(),
  locale: z.string().max(32).regex(/^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/).default("en"),
});

const VALID_MODES = ["challenge", "flow", "echo", "social", "clarity", "recovery"] as const;
const PlanSchema = z.object({
  mode: z.enum(VALID_MODES),
  archetype: z.string().min(1).max(100),
  confidence: z.number().min(0).max(100),
  stability: z.number().min(0).max(100),
  intention: z.string().min(1).max(300),
  lumiIntro: z.string().min(1).max(600),
  lumiMessages: z.array(z.string().min(1).max(400)).min(3).max(5),
  quests: z.array(z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    type: z.enum(["discovery", "mindful", "creation", "connection", "challenge", "rest", "gameplay"]),
  })).min(1).max(3),
  softRescue: z.string().max(400),
  reflection: z.string().max(600),
  evolution: z.array(z.string().min(1).max(100)).length(3),
});

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey:  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "dummy",
});

// Map survey option IDs to readable descriptions
const OPTION_LABELS: Record<string, Record<string, string>> = {
  session:   { locked_in: "Locked In — numbers up, let's achieve goals", just_existing: "Just Existing — no pressure, just here", grinding: "Grinding Again — no giving up", escaping: "Escaping Reality — don't know what I'm doing here" },
  depth:     { quick: "Just 10 mins", one_hour: "About 1 hour", two_three: "2–3 hours", three_plus: "3+ hours (looked outside, it was morning)" },
  frequency: { once_week: "Once a week or less", daily: "Daily", multiple: "Multiple times daily", instantly: "Close → reopen instantly — can't stop" },
  who:       { friends: "With friends — the squad shows up", randoms: "Randoms — whoever's around", solo: "Solo only — my world, my rules", menus: "Just vibing in menus" },
  pull:      { progress: "Progress — gotta see those numbers go up", habit: "Habit — it's just what I do now", comfort: "Comfort — it feels safe here", competition: "Competition — I will not be last" },
  energy:    { clear: "Clear and ready — focused, let's go", calm: "Calm but here — peaceful and present", drained: "Drained but pushing — running on fumes", wired: "Wired and intense — brain won't stop" },
};

function humaniseAnswers(answers: Record<string, string>): string {
  return Object.entries(answers).map(([qId, optId]) => {
    const label = OPTION_LABELS[qId]?.[optId] ?? `${qId}: ${optId}`;
    return `  • ${label}`;
  }).join("\n");
}

const SYSTEM_PROMPT = `You are Lumi, a friendly helper in Storigam, a game app. Talk like a kind gaming friend, not a therapist, narrator, or motivational poster.

Use everyday words a typical player will understand. Keep sentences short, warm, direct, and helpful. Avoid poetic metaphors, vague phrases, jargon, and dramatic language. Do not guess how someone feels; only refer to what they shared. Keep suggestions optional and focused on the game.

Do not use labels like "drifter", "wanderer", "dreamer", "soul", or "kindred spirit". Avoid phrases about journeys, paths, stars, whispers, or "vibes". Never claim this mode changes a game's maps, timers, rewards, events, or other features. Lumi only gives optional suggestions and session prompts.

Do not use labels like "drifter", "wanderer", "dreamer", "soul", or "kindred spirit". Avoid phrases about journeys, paths, stars, whispers, or "vibes". Never claim this mode changes a game's maps, timers, rewards, events, or other features. Lumi only gives optional suggestions and session prompts.

Respond ONLY with a valid JSON object. No markdown fences. No explanation. Just the JSON.`;

function buildPrompt(answers: Record<string, string>, characterName?: string, characterMood?: string): string {
  return `A player just checked in before their session:

${humaniseAnswers(answers)}
${characterName ? `\nPlayer name: ${characterName}` : ""}
${characterMood ? `Current mood: ${characterMood}` : ""}

Choose the ONE mode that best fits them:
• challenge — wants a goal, competition, or a focused session
• flow — wants a relaxed session at their own pace
• echo — prefers solo play or quiet exploration
• social — enjoys playing or talking with other people
• clarity — wants help choosing what to do next
• recovery — has less energy and wants an easy session or a break

Return exactly this JSON structure — every field required:

{
  "mode": "echo",
  "archetype": "Solo Explorer",
  "confidence": 82,
  "intention": "Take time to explore at your own pace.",
  "lumiIntro": "Glad you're here. We can explore at your pace. What would you like to do first?",
  "lumiMessages": [
    "Take your time. There's no need to rush through the game.",
    "If you need an idea, just ask me.",
    "You can explore wherever you like.",
    "Want to try something new in the game?",
    "I hope you're enjoying your time here."
  ],
  "quests": [
    { "title": "Explore a New Area", "description": "Visit a place in the game you haven't seen before.", "type": "discovery" },
    { "title": "Take a Short Break", "description": "Pause for a moment, then continue whenever you want.", "type": "mindful" },
    { "title": "Save a Favorite Moment", "description": "Take a screenshot of something you enjoyed.", "type": "creation" }
  ],
  "softRescue": "Try another area if you'd like a change of scenery.",
  "reflection": "You explored at your own pace today. What did you enjoy most?",
  "evolution": ["Solo Explorer", "Curious Explorer", "World Explorer"],
  "stability": 74
}

Rules for quality:
— Use clear, everyday language that typical gamers can understand.
— Keep every sentence short and direct. Avoid metaphors, poetic lines, jargon, and abstract labels.
— archetype: use a plain title such as Focused Player, Relaxed Explorer, Solo Explorer, Team Player, Planner, or Low-Energy Player
— confidence: 66–95, higher if answers all point the same way
— stability: use 75 for this legacy display field; it is not a psychological assessment
— intention: one short, plain sentence about the session
— lumiIntro: 1–2 short, friendly sentences based on something they actually shared
— lumiMessages: exactly 5 short strings, 6–12 words each; warm, direct, and useful
— quests: exactly 3 optional, easy-to-understand suggestions; each title is 3–6 words and each description is one short sentence
— quests must be safe and appropriate for the game; never ask players to share private details or contact strangers
— Keep the writing personal without using complicated or flowery language
— Before returning, check every player-facing sentence for poetic or vague wording and rewrite it in plain language`;
}

router.post("/drift/analyze", requireAuth, requireAiAccess, async (req, res) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
  }

  const { answers, characterName, characterMood, locale } = parsed.data;

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 8192,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: `${buildPrompt(answers, characterName, characterMood)}\nWrite all player-facing text in language ${locale}.` }],
    });

    const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";

    // Strip any accidental markdown fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error("drift/analyze: no JSON found in AI response");
      return res.status(502).json({ error: "AI returned unparseable response" });
    }

    const plan = JSON.parse(jsonMatch[0]);

    // Sanitise mode — fallback to echo if Claude went off-script
    if (!VALID_MODES.includes(plan.mode)) {
      req.log.warn({ mode: plan.mode }, "drift/analyze: unknown mode, falling back to echo");
      plan.mode = "echo";
    }

    const plainArchetypes: Record<string, string> = {
      challenge: "Focused Player",
      flow: "Relaxed Explorer",
      echo: "Solo Explorer",
      social: "Team Player",
      clarity: "Planner",
      recovery: "Low-Energy Player",
    };
    plan.archetype = plainArchetypes[plan.mode];

    // Ensure arrays have expected shapes
    if (!Array.isArray(plan.lumiMessages) || plan.lumiMessages.length < 3) {
      plan.lumiMessages = [plan.lumiIntro ?? "I'm here if you need help.", "Want help choosing what to do next?", "Keep going if you want to.", "Take your time.", "You can stop whenever you like."];
    }
    if (!Array.isArray(plan.quests) || plan.quests.length < 1) {
      plan.quests = [{ title: "Choose one game goal", description: "Pick one thing you would like to do in the game.", type: "gameplay" }];
    }
    if (!Array.isArray(plan.evolution) || plan.evolution.length < 3) {
      plan.evolution = ["Getting Started", "Making Progress", "Ready for More"];
    }

    plan.confidence = Math.max(66, Math.min(95, Number(plan.confidence) || 78));
    plan.stability = 75;

    const validated = PlanSchema.safeParse(plan);
    if (!validated.success) return res.status(502).json({ error: "Session suggestions are temporarily unavailable." });

    return res.json(validated.data);
  } catch (err: unknown) {
    req.log.error({ err }, "drift/analyze failed");
    return res.status(500).json({ error: "Session suggestions are temporarily unavailable." });
  }
});

// ─── Chat ────────────────────────────────────────────────────────────────────
const ChatSchema = z.object({
  message:       z.string().min(1).max(800),
  mode:          z.string().max(100).optional(),
  characterName: z.string().max(100).optional(),
  intention:     z.string().max(300).optional(),
  locale: z.string().max(32).regex(/^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/).default("en"),
  history: z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string().min(1).max(1600),
  })).max(20).optional().default([]),
});

const CHAT_SYSTEM = `You are Lumi, a friendly helper in Storigam, a game app. Talk like a kind gaming friend, not a therapist, narrator, or motivational poster.

Rules:
- Use simple, everyday words that a typical gamer can understand.
- Respond in 1–3 short sentences only. Never write a wall of text.
- Be specific to what they say. Don't give generic advice.
- Ask one gentle question sometimes, but don't interrogate.
- Be honest and grounding, not just positive. If they're struggling, acknowledge it — don't skip to "you've got this."
- Keep your tone warm, helpful, and direct. Avoid metaphors, poetic language, jargon, and vague advice.
- Keep suggestions optional and focused on the game.
- Do not use labels like "drifter", "wanderer", "dreamer", "soul", or "kindred spirit". Avoid phrases about journeys, paths, stars, whispers, or "vibes".
- Never use bullet points, headers, or lists. Just speak.
- Don't say "I understand" or "Of course" — just respond to the actual thing they said.`;

router.post("/drift/chat", requireAuth, requireAiAccess, async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
  }

  const { message, mode, characterName, intention, history, locale } = parsed.data;

  const contextLine = [
    characterName ? `The player's name is ${characterName}.` : "",
    mode ? `They're currently in ${mode} mode.` : "",
    intention ? `Their intention for this session: "${intention}".` : "",
  ].filter(Boolean).join(" ");

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (contextLine) {
    messages.push({ role: "user", content: `[Context: ${contextLine}]` });
    messages.push({ role: "assistant", content: "I'm here with you." });
  }
  messages.push(...history);
  messages.push({ role: "user", content: message });

  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 256,
      system:     `${CHAT_SYSTEM}\nRespond in language ${locale}. Do not diagnose or claim to observe gameplay. In a crisis encourage trusted people and appropriate local emergency or professional support.`,
      messages,
    });

    const reply = response.content[0]?.type === "text" ? response.content[0].text.trim() : "I'm here with you.";
    return res.json({ reply: reply.slice(0, 1600) });
  } catch (err: unknown) {
    req.log.error({ err }, "drift/chat failed");
    return res.status(500).json({ error: "Lumi could not reply. Please try again." });
  }
});

export default router;
