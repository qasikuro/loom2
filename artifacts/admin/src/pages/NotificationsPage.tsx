import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../api";
import { DEEP_LINK_GROUPS } from "../lib/deepLinks";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Broadcast {
  id:        string;
  title:     string;
  body:      string;
  audience:  string;
  sentAt:    string | null;
  sentCount: number;
  createdAt: string;
  deepLink:  string | null;
}

type Audience = "all" | "beta" | "founders" | "banned" | "admins" | "guides" | "recent";

interface AudienceMeta {
  label:       string;
  description: string;
  badge:       string; // Tailwind classes for the history badge
}

const AUDIENCES: Record<Audience, AudienceMeta> = {
  all:      { label: "Everyone",         description: "All users with push notifications enabled",           badge: "bg-secondary text-secondary-foreground" },
  recent:   { label: "Recently Active",  description: "Users active in the last 7 days",                    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  beta:     { label: "Beta Testers",     description: "Users with the beta tester flag",                    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  founders: { label: "Founders",         description: "Users with the founder status",                      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  guides:   { label: "Guides",           description: "Constellation Guides",                               badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  admins:   { label: "Admins",           description: "Admin users only",                                   badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  banned:   { label: "Banned Users",     description: "Users currently banned — e.g. policy reminders",    badge: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
};

const AUDIENCE_ORDER: Audience[] = ["all", "recent", "beta", "founders", "guides", "admins", "banned"];

// ── Deep Link Destinations ────────────────────────────────────────────────────
// Route list lives in src/lib/deepLinks.ts — edit there to add new destinations.

const CUSTOM_DEEP_LINK = "__custom__";
const NONE_DEEP_LINK   = "__none__";

/** Returns true if s looks like a valid Expo Router path */
function isValidDeepLinkPath(s: string): boolean {
  return /^\/[^\s]*$/.test(s.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [error,   setError]         = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);

  // Form state
  const [title,           setTitle]           = useState("");
  const [body,            setBody]            = useState("");
  const [audience,        setAudience]        = useState<Audience>("all");
  const [deepLinkChoice,  setDeepLinkChoice]  = useState<string>(NONE_DEEP_LINK); // preset path, CUSTOM_DEEP_LINK, NONE_DEEP_LINK
  const [customDeepLink,  setCustomDeepLink]  = useState("");              // used when choice === CUSTOM_DEEP_LINK
  const [deepLinkError,   setDeepLinkError]   = useState<string | null>(null);

  /** The resolved path sent to the API (empty string = no deep link) */
  const resolvedDeepLink =
    deepLinkChoice === NONE_DEEP_LINK   ? ""
    : deepLinkChoice === CUSTOM_DEEP_LINK ? customDeepLink.trim()
    : deepLinkChoice;

  const isCustomMode = deepLinkChoice === CUSTOM_DEEP_LINK;

  // Audience count preview
  const [audienceCount,        setAudienceCount]        = useState<number | null>(null);
  const [audienceCountLoading, setAudienceCountLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { broadcasts: b } = await apiFetch<{ broadcasts: Broadcast[] }>("/admin/notifications");
      setBroadcasts(b);
    } catch {
      setError("Failed to load notification history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch audience count whenever the audience selection changes
  useEffect(() => {
    let cancelled = false;
    setAudienceCount(null);
    setAudienceCountLoading(true);
    apiFetch<{ count: number }>(`/admin/notifications/audience-count?audience=${audience}`)
      .then(res => { if (!cancelled) setAudienceCount(res.count); })
      .catch(() => { if (!cancelled) setAudienceCount(null); })
      .finally(() => { if (!cancelled) setAudienceCountLoading(false); });
    return () => { cancelled = true; };
  }, [audience]);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required");
      return;
    }
    // Validate custom path before sending
    if (isCustomMode && customDeepLink.trim() && !isValidDeepLinkPath(customDeepLink)) {
      setDeepLinkError("Path must start with / and contain no spaces (e.g. /season or /(tabs)/discover)");
      return;
    }
    setDeepLinkError(null);
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; sentCount: number }>("/admin/notifications/broadcast", {
        method: "POST",
        body:   JSON.stringify({ title: title.trim(), body: body.trim(), audience, ...(resolvedDeepLink ? { deepLink: resolvedDeepLink } : {}) }),
      });
      setSuccess(`Sent to ${res.sentCount} device${res.sentCount !== 1 ? "s" : ""}`);
      setTitle("");
      setBody("");
      setAudience("all");
      setDeepLinkChoice(NONE_DEEP_LINK);
      setCustomDeepLink("");
      setDeepLinkError(null);
      setTimeout(() => setSuccess(null), 4000);
      await load();
    } catch (e: unknown) {
      setError((e as Error).message ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      await apiFetch(`/admin/notifications/${id}`, { method: "DELETE" });
      setBroadcasts(prev => prev.filter(b => b.id !== id));
    } catch {
      setError("Delete failed");
    }
  };

  const meta = AUDIENCES[audience] ?? AUDIENCES.all;

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Push Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send announcements directly to users' devices.
        </p>
      </div>

      {/* ── Compose ── */}
      <section className="bg-card border rounded-xl divide-y">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            New Notification
          </h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          {error   && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600 font-medium">✓ {success}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Title
            </label>
            <Input
              placeholder="e.g. Weekend Challenge is live!"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Message
            </label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="What do you want to tell users?"
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{body.length}/500</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Deep Link <span className="normal-case font-normal">(optional)</span>
            </label>
            <Select
              value={deepLinkChoice}
              onValueChange={v => { setDeepLinkChoice(v); setDeepLinkError(null); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="None — open the app home screen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_DEEP_LINK}>None — open app home</SelectItem>
                <SelectSeparator />
                {DEEP_LINK_GROUPS.map(group => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{opt.value}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectSeparator />
                <SelectItem value={CUSTOM_DEEP_LINK}>Custom path…</SelectItem>
              </SelectContent>
            </Select>

            {isCustomMode && (
              <div className="space-y-1">
                <Input
                  placeholder="e.g. /story/abc123 or /(tabs)/profile"
                  value={customDeepLink}
                  onChange={e => { setCustomDeepLink(e.target.value); setDeepLinkError(null); }}
                  maxLength={500}
                  className={deepLinkError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {deepLinkError && (
                  <p className="text-xs text-destructive">{deepLinkError}</p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {resolvedDeepLink
                ? <>Tapping the notification will open <code className="font-mono text-foreground">{resolvedDeepLink}</code>.</>
                : "When set, tapping the notification opens that screen directly."}
            </p>
          </div>

          {/* ── Audience picker ── */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Send To
            </label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_ORDER.map(a => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    audience === a
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {AUDIENCES[a].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
            <p className="text-xs text-muted-foreground">
              {audienceCountLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  Counting devices…
                </span>
              ) : audienceCount !== null ? (
                <span>→ <strong className="text-foreground">{audienceCount.toLocaleString()}</strong> device{audienceCount !== 1 ? "s" : ""}</span>
              ) : null}
            </p>
          </div>

          <div className="pt-1">
            <Button
              onClick={send}
              disabled={sending || !title.trim() || !body.trim()}
              className="w-full"
            >
              {sending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Sending…
                </span>
              ) : audienceCount !== null ? (
                `Send to ${meta.label} (${audienceCount.toLocaleString()} device${audienceCount !== 1 ? "s" : ""})`
              ) : (
                `Send to ${meta.label}`
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* ── History ── */}
      <section className="bg-card border rounded-xl divide-y">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h2>
          <span className="text-xs text-muted-foreground">{broadcasts.length} sent</span>
        </div>

        {loading ? (
          <div className="px-5 py-6 flex items-center gap-2 text-muted-foreground text-sm">
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No notifications sent yet.
          </div>
        ) : (
          broadcasts.map(b => {
            const bMeta = AUDIENCES[b.audience as Audience];
            return (
              <div key={b.id} className="px-5 py-4 flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{b.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      bMeta?.badge ?? "bg-secondary text-secondary-foreground"
                    }`}>
                      {bMeta?.label ?? b.audience}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.body}</p>
                  {b.deepLink && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                      → {b.deepLink}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {b.sentCount.toLocaleString()} device{b.sentCount !== 1 ? "s" : ""} ·{" "}
                    {b.sentAt ? new Date(b.sentAt).toLocaleString() : "—"}
                  </p>
                </div>
                <button
                  onClick={() => deleteRecord(b.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors text-xs shrink-0 mt-0.5"
                  title="Remove from history"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
