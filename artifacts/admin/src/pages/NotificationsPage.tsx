import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Broadcast {
  id:        string;
  title:     string;
  body:      string;
  audience:  string;
  sentAt:    string | null;
  sentCount: number;
  createdAt: string;
}

type Audience = "all" | "beta";

const AUDIENCE_LABELS: Record<Audience, string> = {
  all:  "Everyone",
  beta: "Beta testers only",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [error,   setError]         = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);

  // Form state
  const [title,    setTitle]    = useState("");
  const [body,     setBody]     = useState("");
  const [audience, setAudience] = useState<Audience>("all");

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

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; sentCount: number }>("/admin/notifications/broadcast", {
        method: "POST",
        body:   JSON.stringify({ title: title.trim(), body: body.trim(), audience }),
      });
      setSuccess(`Sent to ${res.sentCount} device${res.sentCount !== 1 ? "s" : ""}`);
      setTitle("");
      setBody("");
      setAudience("all");
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
              Send To
            </label>
            <div className="flex gap-2">
              {(["all", "beta"] as Audience[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    audience === a
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {AUDIENCE_LABELS[a]}
                </button>
              ))}
            </div>
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
              ) : (
                `Send to ${AUDIENCE_LABELS[audience]}`
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
          broadcasts.map(b => (
            <div key={b.id} className="px-5 py-4 flex gap-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{b.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    b.audience === "beta"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-secondary text-secondary-foreground"
                  }`}>
                    {AUDIENCE_LABELS[b.audience as Audience] ?? b.audience}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.body}</p>
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
          ))
        )}
      </section>
    </div>
  );
}
