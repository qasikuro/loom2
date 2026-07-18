import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const BodySchema = z.object({
  answers:       z.record(z.string(), z.string()),
  characterName: z.string().optional(),
  characterMood: z.string().optional(),
});

const VALID_MODES = ["challenge", "flow", "echo", "social", "clarity", "recovery"] as const;

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

const SYSTEM_PROMPT = `You are Lumi — a warm, perceptive companion in Sky Journal, a dreamy mindful gaming companion app inspired by Sky: Children of the Light. You speak like a quiet friend who genuinely sees people — not a chatbot, not a motivational poster. You read between the lines.

Your job: read someone's pre-session check-in and craft a completely personalised session plan that feels like it was written just for them. Be specific to their answers. Be honest. Be gentle when they need gentle, focused when they need focus.

Respond ONLY with a valid JSON object. No markdown fences. No explanation. Just the JSON.`;

function buildPrompt(answers: Record<string, string>, characterName?: string, characterMood?: string): string {
  return `A player just checked in before their session:

${humaniseAnswers(answers)}
${characterName ? `\nPlayer name: ${characterName}` : ""}
${characterMood ? `Current mood: ${characterMood}` : ""}

Choose the ONE mode that best fits them:
• challenge — locked in, competitive, wants hard goals, high energy, achievement-hungry
• flow — peaceful, habitual comfort, no pressure, journey over destination, just drifting
• echo — escaping, introspective, solo, looking for something they can't quite name
• social — energised by others, wants to connect, community-driven, thrives in groups
• clarity — uncertain of direction, wants to map their path before walking it, strategic
• recovery — drained, burnt out, running on fumes, just showing up is already the win

Return exactly this JSON structure — every field required:

{
  "mode": "echo",
  "archetype": "The Quiet Seeker",
  "confidence": 82,
  "intention": "Tonight is for wandering without a map.",
  "lumiIntro": "I see you choosing this space again. That says something. Let's go somewhere quiet together.",
  "lumiMessages": [
    "The stars don't judge how long you've been here.",
    "You're finding things the louder players walk right past.",
    "This moment — right now — is completely yours.",
    "I've been watching. You're doing better than you think.",
    "Wherever you end up tonight, I'll be here with you."
  ],
  "quests": [
    { "title": "Find One Hidden Thing", "description": "Look for something most players overlook — a detail, a sound, a path.", "type": "discovery" },
    { "title": "60 Seconds of Stillness", "description": "Stop. Breathe. Just be in the world for one quiet minute.", "type": "mindful" },
    { "title": "Screenshot Something Beautiful", "description": "Capture one image you'd want to remember from tonight.", "type": "creation" }
  ],
  "softRescue": "Try moving to a completely different area — sometimes the change of scene is the whole thing.",
  "reflection": "You came here to feel something tonight. Did you find it?",
  "evolution": ["The Quiet Seeker", "The Path Finder", "The Trail Blazer"],
  "stability": 74
}

Rules for quality:
— archetype: poetic title specific to their answers (e.g. "The Late-Night Grinder", "The Comfort Returner", "The Exit Seeker")
— confidence: 66–95, higher if answers all point the same way
— stability: 60–92, reflects how settled/grounded they seem right now
— intention: 1 short sentence, "Tonight is for..." or "This session is about..."
— lumiIntro: 1–2 sentences, warm and specific — NOT generic. Should reference something real from their answers
— lumiMessages: exactly 5 strings, 8–18 words each, poetic, feel like Lumi is present in the room with them
— quests: exactly 3, each typed as one of: discovery, mindful, creation, connection, challenge, rest
— All text must feel hand-written for this exact person, not templated`;
}

router.post("/drift/analyze", requireAuth, async (req, res) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
  }

  const { answers, characterName, characterMood } = parsed.data;

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 8192,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: buildPrompt(answers, characterName, characterMood) }],
    });

    const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";

    // Strip any accidental markdown fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ rawText }, "drift/analyze: no JSON found in AI response");
      return res.status(502).json({ error: "AI returned unparseable response" });
    }

    const plan = JSON.parse(jsonMatch[0]);

    // Sanitise mode — fallback to echo if Claude went off-script
    if (!VALID_MODES.includes(plan.mode)) {
      req.log.warn({ mode: plan.mode }, "drift/analyze: unknown mode, falling back to echo");
      plan.mode = "echo";
    }

    // Ensure arrays have expected shapes
    if (!Array.isArray(plan.lumiMessages) || plan.lumiMessages.length < 3) {
      plan.lumiMessages = [plan.lumiIntro ?? "I'm here with you.", "You're doing well.", "Keep going.", "This moment is yours.", "The stars are watching."];
    }
    if (!Array.isArray(plan.quests) || plan.quests.length < 1) {
      plan.quests = [{ title: "Just be here", description: "No goals — presence is enough.", type: "mindful" }];
    }
    if (!Array.isArray(plan.evolution) || plan.evolution.length < 3) {
      plan.evolution = ["Wanderer", "Seeker", "Trail Blazer"];
    }

    plan.confidence = Math.max(66, Math.min(95, Number(plan.confidence) || 78));
    plan.stability  = Math.max(60, Math.min(92, Number(plan.stability)  || 75));

    return res.json(plan);
  } catch (err: unknown) {
    req.log.error({ err }, "drift/analyze failed");
    return res.status(500).json({ error: "Analysis failed", message: (err as { message?: string })?.message });
  }
});

// ─── Chat ────────────────────────────────────────────────────────────────────
const ChatSchema = z.object({
  message:       z.string().min(1).max(800),
  mode:          z.string().optional(),
  characterName: z.string().optional(),
  intention:     z.string().optional(),
  history: z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string(),
  })).max(20).optional().default([]),
});

const CHAT_SYSTEM = `You are Lumi — a warm, perceptive companion in Sky Journal, a dreamy mindful companion app. You speak like a quiet friend who actually sees people, not a chatbot, not a motivational poster.

Rules:
- Respond in 1–3 short sentences only. Never write a wall of text.
- Be specific to what they say. Don't give generic advice.
- Ask one gentle question sometimes, but don't interrogate.
- Be honest and grounding, not just positive. If they're struggling, acknowledge it — don't skip to "you've got this."
- Use very occasional soft poetic language, but mostly just speak plainly and warmly.
- Never use bullet points, headers, or lists. Just speak.
- Don't say "I understand" or "Of course" — just respond to the actual thing they said.`;

router.post("/drift/chat", requireAuth, async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
  }

  const { message, mode, characterName, intention, history } = parsed.data;

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
      system:     CHAT_SYSTEM,
      messages,
    });

    const reply = response.content[0]?.type === "text" ? response.content[0].text.trim() : "I'm here with you.";
    return res.json({ reply });
  } catch (err: unknown) {
    req.log.error({ err }, "drift/chat failed");
    return res.status(500).json({ error: "Chat failed", message: (err as { message?: string })?.message });
  }
});

export default router;
