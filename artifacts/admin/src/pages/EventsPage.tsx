import { useEffect, useState, useCallback } from "react";
import { api, type AdminEvent, type EventInventoryItem, type EventBody } from "../api";

// ── Constants ─────────────────────────────────────────────────────────────────

const THEMES = ["spring", "summer", "autumn", "winter", "special"] as const;
type Theme = (typeof THEMES)[number];

const THEME_META: Record<Theme, { icon: string; color: string; label: string }> = {
  spring:  { icon: "🌸", color: "bg-pink-100 text-pink-700",    label: "Spring"  },
  summer:  { icon: "☀️",  color: "bg-yellow-100 text-yellow-700", label: "Summer"  },
  autumn:  { icon: "🍂", color: "bg-orange-100 text-orange-700", label: "Autumn"  },
  winter:  { icon: "❄️",  color: "bg-blue-100 text-blue-700",    label: "Winter"  },
  special: { icon: "✦",  color: "bg-purple-100 text-purple-700", label: "Special" },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:  { color: "bg-gray-100 text-gray-600",    label: "Draft"  },
  active: { color: "bg-green-100 text-green-700",  label: "Active" },
  ended:  { color: "bg-red-100 text-red-600",      label: "Ended"  },
};

const ITEM_TYPE_META: Record<string, { icon: string; color: string }> = {
  stars:  { icon: "⭐", color: "text-yellow-600" },
  aura:   { icon: "🔵", color: "text-blue-600"   },
  shards: { icon: "💎", color: "text-purple-600" },
  item:   { icon: "🎁", color: "text-pink-600"   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function blankBody(): EventBody {
  return {
    title:       "",
    description: "",
    theme:       "special",
    status:      "draft",
    startsAt:    null,
    endsAt:      null,
    inventory:   [],
    aiPrompt:    "",
  };
}

// ── Inventory item editor row ─────────────────────────────────────────────────

function InventoryRow({
  item,
  onUpdate,
  onRemove,
}: {
  item:     EventInventoryItem;
  onUpdate: (next: EventInventoryItem) => void;
  onRemove: () => void;
}) {
  const isCurrency = item.type !== "item";

  return (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-b-0">
      <span className={`text-lg ${ITEM_TYPE_META[item.type]?.color}`}>
        {ITEM_TYPE_META[item.type]?.icon}
      </span>

      <select
        value={item.type}
        onChange={(e) => {
          const t = e.target.value as EventInventoryItem["type"];
          if (t === "item") onUpdate({ type: "item", itemId: "", itemName: "", label: "" });
          else              onUpdate({ type: t, amount: 100, label: `100 ${t}` });
        }}
        className="text-xs border rounded px-1.5 py-1 bg-background"
      >
        <option value="stars">Stars</option>
        <option value="aura">Aura Energy</option>
        <option value="shards">Memory Shards</option>
        <option value="item">Cosmetic Item</option>
      </select>

      {isCurrency ? (
        <input
          type="number"
          min={1}
          value={item.amount ?? ""}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10) || 1;
            onUpdate({ ...item, amount: n, label: `${n} ${item.type}` });
          }}
          className="w-24 text-xs border rounded px-2 py-1 bg-background"
          placeholder="Amount"
        />
      ) : (
        <>
          <input
            value={item.itemId ?? ""}
            onChange={(e) => onUpdate({ ...item, itemId: e.target.value, label: item.itemName || e.target.value })}
            className="w-32 text-xs border rounded px-2 py-1 bg-background"
            placeholder="item_id"
          />
          <input
            value={item.itemName ?? ""}
            onChange={(e) => onUpdate({ ...item, itemName: e.target.value, label: e.target.value })}
            className="flex-1 text-xs border rounded px-2 py-1 bg-background"
            placeholder="Display name"
          />
        </>
      )}

      <button
        onClick={onRemove}
        className="ml-auto text-muted-foreground hover:text-red-500 text-sm px-1 transition-colors"
        title="Remove"
      >✕</button>
    </div>
  );
}

// ── Event form (create / edit) ────────────────────────────────────────────────

function EventForm({
  initial,
  onSave,
  onCancel,
}: {
  initial:  EventBody;
  onSave:   (body: EventBody) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EventBody>(initial);
  const [saving, setSaving]     = useState(false);
  const [generating, setGen]    = useState(false);
  const [error, setError]       = useState("");
  const [extraPrompt, setExtra] = useState("");

  const set = (patch: Partial<EventBody>) => setForm((f) => ({ ...f, ...patch }));

  const updateItem = (i: number, next: EventInventoryItem) =>
    set({ inventory: form.inventory.map((it, idx) => (idx === i ? next : it)) });
  const removeItem = (i: number) =>
    set({ inventory: form.inventory.filter((_, idx) => idx !== i) });
  const addItem = (type: EventInventoryItem["type"]) => {
    const newItem: EventInventoryItem =
      type === "item"
        ? { type: "item", itemId: "", itemName: "", label: "" }
        : { type, amount: 100, label: `100 ${type}` };
    set({ inventory: [...form.inventory, newItem] });
  };

  const generate = async () => {
    if (!form.title) { setError("Add a title first"); return; }
    setGen(true);
    setError("");
    try {
      const { inventory } = await api.generateInventory({
        title:       form.title,
        description: form.description,
        theme:       form.theme,
        extra:       extraPrompt,
      });
      set({ inventory });
    } catch (e: any) {
      setError("AI generation failed: " + e.message);
    } finally {
      setGen(false);
    }
  };

  const save = async (status?: string) => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(status ? { ...form, status } : form);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Basic fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event title *</label>
          <input
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="e.g. Lantern Festival"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Theme</label>
          <select
            value={form.theme}
            onChange={(e) => set({ theme: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>{THEME_META[t].icon} {THEME_META[t].label}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none"
            placeholder="Describe the event for players…"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start date</label>
          <input
            type="datetime-local"
            value={form.startsAt ? form.startsAt.slice(0, 16) : ""}
            onChange={(e) => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End date</label>
          <input
            type="datetime-local"
            value={form.endsAt ? form.endsAt.slice(0, 16) : ""}
            onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
          <select
            value={form.status}
            onChange={(e) => set({ status: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      </div>

      {/* AI inventory generation */}
      <div className="bg-muted/40 rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">✨ AI Inventory Generator</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Uses Claude to design themed reward drops. Your title + description are the prompt.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating || !form.title}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {generating ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />Generating…</>
            ) : "Generate with AI"}
          </button>
        </div>

        <input
          value={extraPrompt}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Extra context for AI (optional) — e.g. 'Focus on dreamy cosmetics, avoid stars'"
          className="w-full border rounded-lg px-3 py-2 text-xs bg-background"
        />
      </div>

      {/* Inventory list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Inventory ({form.inventory.length} items)</h3>
          <div className="flex gap-1.5">
            {(["stars", "aura", "shards", "item"] as const).map((t) => (
              <button
                key={t}
                onClick={() => addItem(t)}
                className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                title={`Add ${t}`}
              >
                {ITEM_TYPE_META[t].icon} {t}
              </button>
            ))}
          </div>
        </div>

        <div className="border rounded-xl divide-y bg-card">
          {form.inventory.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No items yet — generate with AI or add manually
            </p>
          ) : (
            <div className="px-3 py-1">
              {form.inventory.map((item, i) => (
                <InventoryRow
                  key={i}
                  item={item}
                  onUpdate={(next) => updateItem(i, next)}
                  onRemove={() => removeItem(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => save()}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onEdit,
  onDelete,
  onGrant,
}: {
  event:    AdminEvent;
  onEdit:   () => void;
  onDelete: () => void;
  onGrant:  () => void;
}) {
  const [grantState, setGrantState] = useState<"idle" | "confirm" | "granting" | "done">("idle");
  const [grantResult, setGrantResult] = useState("");
  const [deleteState, setDeleteState] = useState<"idle" | "confirm">("idle");

  const theme  = THEME_META[event.theme as Theme] ?? THEME_META.special;
  const status = STATUS_META[event.status] ?? STATUS_META.draft;

  const doGrant = async () => {
    setGrantState("granting");
    try {
      const r = await api.grantEvent(event.id);
      setGrantResult(r.message + ` (⭐${r.stars} 🔵${r.aura} 💎${r.shards})`);
      setGrantState("done");
      onGrant();
    } catch (e: any) {
      setGrantResult("Failed: " + e.message);
      setGrantState("done");
    }
  };

  const currencyItems  = event.inventory.filter((i) => i.type !== "item");
  const cosmeticItems  = event.inventory.filter((i) => i.type === "item");

  return (
    <div className="bg-card border rounded-xl p-5 space-y-4 hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          {theme.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{event.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
              {status.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${theme.color}`}>
              {theme.label}
            </span>
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {fmtDate(event.startsAt)} → {fmtDate(event.endsAt)}
          </p>
        </div>
      </div>

      {/* Inventory preview */}
      {event.inventory.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currencyItems.map((it, i) => (
            <span key={i} className="text-xs px-2 py-1 bg-muted rounded-full">
              {ITEM_TYPE_META[it.type]?.icon} {it.label}
            </span>
          ))}
          {cosmeticItems.map((it, i) => (
            <span key={i} className="text-xs px-2 py-1 bg-pink-50 text-pink-700 rounded-full">
              🎁 {it.itemName || it.label}
            </span>
          ))}
        </div>
      )}

      {/* Grant result */}
      {grantState === "done" && grantResult && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✓ {grantResult}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
        <button
          onClick={onEdit}
          className="text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
        >
          Edit
        </button>

        {/* Grant button with confirm */}
        {grantState === "idle" && (
          <button
            onClick={() => setGrantState("confirm")}
            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            disabled={event.inventory.length === 0}
            title={event.inventory.length === 0 ? "Add inventory items first" : ""}
          >
            🎁 Grant to All Users
          </button>
        )}
        {grantState === "confirm" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Grant to every user?</span>
            <button
              onClick={doGrant}
              className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setGrantState("idle")}
              className="text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {grantState === "granting" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin inline-block" />
            Granting…
          </span>
        )}
        {grantState === "done" && (
          <button
            onClick={() => setGrantState("idle")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Done
          </button>
        )}

        {/* Delete button with confirm */}
        {deleteState === "idle" ? (
          <button
            onClick={() => setDeleteState("confirm")}
            className="text-xs px-3 py-1.5 text-muted-foreground hover:text-red-600 transition-colors ml-auto"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-red-600">Delete this event?</span>
            <button
              onClick={onDelete}
              className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteState("idle")}
              className="text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type View = "list" | "create" | { editing: AdminEvent };

export default function EventsPage() {
  const [view, setView]     = useState<View>("list");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [toast, setToast]     = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getEvents();
      setEvents(data.events);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async (body: EventBody) => {
    await api.createEvent(body);
    showToast("Event created!");
    setView("list");
    load();
  };

  const handleUpdate = async (id: string, body: EventBody) => {
    await api.updateEvent(id, body);
    showToast("Event updated!");
    setView("list");
    load();
  };

  const handleDelete = async (id: string) => {
    await api.deleteEvent(id);
    showToast("Event deleted");
    load();
  };

  // Split by status
  const active  = events.filter((e) => e.status === "active");
  const draft   = events.filter((e) => e.status === "draft");
  const ended   = events.filter((e) => e.status === "ended");

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan in-game events and push reward inventory to all players
          </p>
        </div>
        {view === "list" && (
          <button
            onClick={() => setView("create")}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            + New Event
          </button>
        )}
        {view !== "list" && (
          <button
            onClick={() => setView("list")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to events
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      {/* Create / Edit form */}
      {view === "create" && (
        <div className="bg-card border rounded-xl p-6 space-y-2">
          <h2 className="font-semibold text-lg mb-4">New Event</h2>
          <EventForm
            initial={blankBody()}
            onSave={handleCreate}
            onCancel={() => setView("list")}
          />
        </div>
      )}

      {typeof view === "object" && "editing" in view && (
        <div className="bg-card border rounded-xl p-6 space-y-2">
          <h2 className="font-semibold text-lg mb-4">Edit Event</h2>
          <EventForm
            initial={{
              title:       view.editing.title,
              description: view.editing.description,
              theme:       view.editing.theme,
              status:      view.editing.status,
              startsAt:    view.editing.startsAt,
              endsAt:      view.editing.endsAt,
              inventory:   view.editing.inventory,
              aiPrompt:    view.editing.aiPrompt,
            }}
            onSave={(body) => handleUpdate(view.editing.id, body)}
            onCancel={() => setView("list")}
          />
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <>
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>}
          {loading && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-card border rounded-xl p-5 animate-pulse space-y-3">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-40" />
                      <div className="h-3 bg-muted rounded w-64" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && events.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">✦</div>
              <p className="text-sm">No events yet — create your first one!</p>
            </div>
          )}

          {!loading && active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active</h2>
              {active.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onEdit={() => setView({ editing: ev })}
                  onDelete={() => handleDelete(ev.id)}
                  onGrant={load}
                />
              ))}
            </section>
          )}

          {!loading && draft.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drafts</h2>
              {draft.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onEdit={() => setView({ editing: ev })}
                  onDelete={() => handleDelete(ev.id)}
                  onGrant={load}
                />
              ))}
            </section>
          )}

          {!loading && ended.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ended</h2>
              {ended.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onEdit={() => setView({ editing: ev })}
                  onDelete={() => handleDelete(ev.id)}
                  onGrant={load}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
