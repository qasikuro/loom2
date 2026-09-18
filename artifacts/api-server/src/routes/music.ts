/**
 * Audius music discovery.
 *
 * Keep Audius credentials server-side. The mobile client talks only to this
 * authenticated app route and never receives either provider credential.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
const AUDIUS_BASE = "https://discoveryprovider.audius.co/v1";
const AUDIUS_APP_NAME = "GameJo";
const AUDIUS_API_KEY = process.env.AUDIUS_API_KEY;
const AUDIUS_API_BEARER_TOKEN = process.env.AUDIUS_API_BEARER_TOKEN;

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(80).default("peaceful"),
});

type AudiusApiTrack = {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string | null;
  mood?: string | null;
  tags?: string | null;
  artwork?: { "150x150"?: string; "480x480"?: string; "1000x1000"?: string } | null;
  user?: { name?: string } | null;
};

function trackToClient(track: AudiusApiTrack) {
  if (!track.id || !track.title) return null;
  const artworkUrl = track.artwork?.["480x480"] ?? track.artwork?.["150x150"] ?? null;
  return {
    id:         String(track.id),
    title:      track.title,
    artist:     track.user?.name ?? "Audius artist",
    artworkUrl,
    duration:   Math.max(0, Math.round(track.duration ?? 0)),
    genre:      track.genre ?? null,
    mood:       track.mood ?? null,
    tags:       track.tags ?? null,
    // This URL is stable; Audius signs the redirect when it is requested.
    streamUrl:  `${AUDIUS_BASE}/tracks/${encodeURIComponent(String(track.id))}/stream?app_name=${encodeURIComponent(AUDIUS_APP_NAME)}`,
  };
}

router.get("/music/search", requireAuth, async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Search text must be between 1 and 80 characters" });
  }

  try {
    if (!AUDIUS_API_KEY || !AUDIUS_API_BEARER_TOKEN) {
      req.log.error("Audius credentials are not configured");
      return res.status(503).json({ error: "Audius music is not configured" });
    }

    const url = new URL(`${AUDIUS_BASE}/tracks/search`);
    url.searchParams.set("query", parsed.data.q);
    url.searchParams.set("limit", "30");
    url.searchParams.set("app_name", AUDIUS_APP_NAME);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-API-Key": AUDIUS_API_KEY,
        Authorization: `Bearer ${AUDIUS_API_BEARER_TOKEN}`,
      },
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Audius search is temporarily unavailable" });
    }
    const payload = await response.json() as { data?: AudiusApiTrack[] };
    const tracks = (payload.data ?? []).map(trackToClient).filter((track): track is NonNullable<ReturnType<typeof trackToClient>> => !!track);

    res.setHeader("Cache-Control", "private, max-age=30");
    return res.json({ tracks, source: "Audius" });
  } catch (err) {
    req.log.error({ err }, "Audius search failed");
    return res.status(502).json({ error: "Audius search is temporarily unavailable" });
  }
});

export default router;