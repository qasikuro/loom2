import { useCallback, useEffect, useState } from "react";
import { api, type ProfileEffectRow, type EffectConfig, type EffectBody } from "../api";

// ── Constants ─────────────────────────────────────────────────────────────────

const RARITIES = ["common", "rare", "legendary"] as const;
type Rarity = (typeof RARITIES)[number];

const RARITY_META: Record<Rarity, { label: string; color: string; glow: string }> = {
  common:    { label: "Common",    color: "bg-slate-100 text-slate-600",    glow: "border-slate-200"   },
  rare:      { label: "Rare",      color: "bg-purple-100 text-purple-700",  glow: "border-purple-300"  },
  legendary: { label: "Legendary", color: "bg-amber-100 text-amber-700",    glow: "border-amber-400"   },
};

const THEMES = ["nature", "cosmos", "fire", "water", "darkness", "dreams", "winter", "spring", "special"];

const MODES = ["rise", "fall", "drift", "glow"] as const;
type Mode = (typeof MODES)[number];

const MODE_DESC: Record<Mode, string> = {
  rise:  "Particles float upward (hearts, sparks, lanterns)",
  fall:  "Particles fall from top (petals, leaves, snow)",
  drift: "Particles move in lazy waves (butterflies, feathers)",
  glow:  "Particles pulse in place (fireflies, stars, embers)",
};

// ── Deterministic RNG (matches mobile app) ────────────────────────────────────
function rng(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ── Live CSS animation preview ────────────────────────────────────────────────

function AnimatedPreview({ config, size = "md" }: { config: EffectConfig; size?: "sm" | "md" }) {
  const h = size === "sm" ? 130 : 200;
  const w = size === "sm" ? 140 : 220;

  const particles = Array.from({ length: Math.min(config.count, 10) }, (_, i) => {
    const s = (n: number) => rng(i * 37 + n);
    const left = s(3) * 80 + 10;
    const startTop =
      config.mode === "rise"  ? 55 + s(4) * 35 :
      config.mode === "fall"  ? s(4) * 12 :
      s(4) * 75;
    const delay    = Math.round(i * 380 + s(2) * 600);
    const duration = Math.round(config.speedMs[0] + s(1) * (config.speedMs[1] - config.speedMs[0]));
    const emoji    = config.particles[i % config.particles.length];
    const color    = config.colors?.[i % config.colors.length];
    return { left, startTop, delay, duration, emoji, color };
  });

  const animName = `sky_${config.mode}`;

  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        background: "linear-gradient(135deg, #12102A 0%, #1E1545 60%, #2A1D50 100%)",
        borderRadius: 14,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <style>{`
        @keyframes sky_rise {
          0%   { transform: translateY(0px)   scale(0.8); opacity: 0;    }
          15%  { opacity: 0.92; }
          85%  { opacity: 0.92; }
          100% { transform: translateY(-${Math.round(h * 0.82)}px) scale(1.1); opacity: 0; }
        }
        @keyframes sky_fall {
          0%   { transform: translateY(-20px) rotate(0deg);  opacity: 0;    }
          15%  { opacity: 0.92; }
          85%  { opacity: 0.92; }
          100% { transform: translateY(${Math.round(h * 0.92)}px) rotate(50deg); opacity: 0; }
        }
        @keyframes sky_drift {
          0%   { transform: translate(0px, 0px);                 opacity: 0.8; }
          25%  { transform: translate(20px, -14px) rotate(12deg); opacity: 1.0; }
          75%  { transform: translate(-20px, 12px) rotate(-8deg); opacity: 0.9; }
          100% { transform: translate(0px, 0px);                 opacity: 0.8; }
        }
        @keyframes sky_glow {
          0%, 100% { transform: scale(0.65); opacity: 0.04; }
          50%       { transform: scale(1.35); opacity: 0.95; }
        }
      `}</style>

      {/* Corner accents */}
      {config.corners?.map((c, i) => {
        const isTop    = c.pos === "tl" || c.pos === "tr";
        const isLeft   = c.pos === "tl" || c.pos === "bl";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              fontSize:  c.size * (size === "sm" ? 0.7 : 1),
              lineHeight: 1,
              top:    isTop    ? -4 : "auto",
              bottom: !isTop   ? -4 : "auto",
              left:   isLeft   ? -4 : "auto",
              right:  !isLeft  ? -4 : "auto",
              transform: c.pos === "tr" ? "scaleX(-1)" : c.pos === "br" ? "scale(-1,-1)" : c.pos === "bl" ? "scaleY(-1)" : "none",
              opacity: 0.88,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {c.emoji}
          </div>
        );
      })}

      {/* Tint overlay */}
      {config.overlayTint && (
        <div style={{ position: "absolute", inset: 0, background: config.overlayTint, borderRadius: 14, zIndex: 2 }} />
      )}

      {/* Particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left:     `${p.left}%`,
            top:      `${p.startTop}%`,
            fontSize:  config.fontSize * (size === "sm" ? 0.75 : 1),
            color:     p.color,
            animation: `${animName} ${p.duration}ms ${p.delay}ms infinite ease-in-out`,
            lineHeight: 1,
            userSelect: "none",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Mock profile card skeleton */}
      <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, zIndex: 20, pointerEvents: "none" }}>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: "rgba(200,184,232,0.22)", border: "2px solid rgba(200,184,232,0.38)", marginBottom: 6 }} />
        <div style={{ height: 7,  width: 72, background: "rgba(255,255,255,0.28)", borderRadius: 4, marginBottom: 4 }} />
        <div style={{ height: 5,  width: 48, background: "rgba(255,255,255,0.14)", borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ── Blank form ─────────────────────────────────────────────────────────────────

function blankBody(): EffectBody {
  return {
    name:          "",
    description:   "",
    icon:          "✨",
    theme:         "special",
    rarity:        "common",
    isActive:      true,
    shopCost:      {},
    previewColors: [],
    config: {
      particles:  ["✦", "✧", "⋆"],
      count:      8,
      mode:       "glow",
      fontSize:   18,
      speedMs:    [2200, 4000],
      xSwingPct:  0.14,
      yTravelPct: 0.55,
    },
  };
}

// ── Config editor ─────────────────────────────────────────────────────────────

function ConfigEditor({ config, onChange }: { config: EffectConfig; onChange: (c: EffectConfig) => void }) {
  const set = <K extends keyof EffectConfig>(k: K, v: EffectConfig[K]) => onChange({ ...config, [k]: v });

  return (
    <div className="space-y-4">
      {/* Particles */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Particles (comma-separated emoji)</label>
        <input
          className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
          value={config.particles.join(", ")}
          onChange={e => set("particles", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
        />
      </div>

      {/* Count + Mode */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Count</label>
          <input type="number" min={1} max={20}
            className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
            value={config.count}
            onChange={e => set("count", Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Font size (px)</label>
          <input type="number" min={10} max={48}
            className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
            value={config.fontSize}
            onChange={e => set("fontSize", Math.max(10, Math.min(48, parseInt(e.target.value) || 16)))}
          />
        </div>
      </div>

      {/* Mode */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Animation mode</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {MODES.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => set("mode", m)}
              className={`px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                config.mode === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              }`}
            >
              <div className="font-medium capitalize">{m}</div>
              <div className="text-xs opacity-70 leading-tight">{MODE_DESC[m]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Speed */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Speed range (ms) — lower = faster</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <input type="number" min={400} max={12000} step={100}
            className="px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
            value={config.speedMs[0]}
            onChange={e => set("speedMs", [parseInt(e.target.value) || 1000, config.speedMs[1]])}
          />
          <input type="number" min={400} max={12000} step={100}
            className="px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
            value={config.speedMs[1]}
            onChange={e => set("speedMs", [config.speedMs[0], parseInt(e.target.value) || 2000])}
          />
        </div>
      </div>

      {/* Swing + Travel */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">X swing (0–0.28)</label>
          <input type="number" min={0} max={0.28} step={0.01}
            className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
            value={config.xSwingPct}
            onChange={e => set("xSwingPct", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Y travel (0.4–1.0)</label>
          <input type="number" min={0.1} max={1.2} step={0.01}
            className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
            value={config.yTravelPct}
            onChange={e => set("yTravelPct", parseFloat(e.target.value) || 0.5)}
          />
        </div>
      </div>

      {/* Glyph colors (optional) */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Glyph colors (optional, for abstract symbols like ✦ ⋆)
        </label>
        <input
          className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none font-mono"
          placeholder="#E8D44A, #F0E060, #D8C840"
          value={(config.colors ?? []).join(", ")}
          onChange={e => {
            const arr = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
            set("colors", arr.length ? arr : undefined);
          }}
        />
      </div>

      {/* Overlay tint */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Overlay tint (optional, max opacity 0.09)
        </label>
        <input
          className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none font-mono"
          placeholder="rgba(200,240,200,0.06)"
          value={config.overlayTint ?? ""}
          onChange={e => set("overlayTint", e.target.value || undefined)}
        />
      </div>

      {/* Corners */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Corner accents (Discord-style frame elements)</label>
          <button
            type="button"
            onClick={() => {
              const positions: Array<"tl" | "tr" | "bl" | "br"> = ["tl", "tr", "bl", "br"];
              const existing = (config.corners ?? []).map(c => c.pos);
              const next = positions.find(p => !existing.includes(p));
              if (!next) return;
              set("corners", [...(config.corners ?? []), { pos: next, emoji: "🌿", size: 38 }]);
            }}
            className="text-xs text-primary hover:underline"
          >
            + Add corner
          </button>
        </div>
        <div className="space-y-2 mt-2">
          {(config.corners ?? []).map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <select
                className="text-xs bg-background border rounded px-2 py-1"
                value={c.pos}
                onChange={e => {
                  const updated = [...(config.corners ?? [])];
                  updated[i] = { ...c, pos: e.target.value as "tl" | "tr" | "bl" | "br" };
                  set("corners", updated);
                }}
              >
                <option value="tl">↖ Top-left</option>
                <option value="tr">↗ Top-right</option>
                <option value="bl">↙ Bottom-left</option>
                <option value="br">↘ Bottom-right</option>
              </select>
              <input
                className="w-16 text-center text-sm bg-background border rounded px-2 py-1"
                value={c.emoji}
                onChange={e => {
                  const updated = [...(config.corners ?? [])];
                  updated[i] = { ...c, emoji: e.target.value };
                  set("corners", updated);
                }}
              />
              <input type="number" min={16} max={80}
                className="w-16 text-xs bg-background border rounded px-2 py-1"
                value={c.size}
                onChange={e => {
                  const updated = [...(config.corners ?? [])];
                  updated[i] = { ...c, size: parseInt(e.target.value) || 36 };
                  set("corners", updated);
                }}
              />
              <button
                type="button"
                onClick={() => set("corners", (config.corners ?? []).filter((_, j) => j !== i))}
                className="ml-auto text-destructive hover:opacity-80 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

function EffectModal({
  initial,
  onSave,
  onClose,
}: {
  initial?:  ProfileEffectRow;
  onSave:    (body: EffectBody) => Promise<void>;
  onClose:   () => void;
}) {
  const [body,        setBody]        = useState<EffectBody>(initial ? {
    name:          initial.name,
    description:   initial.description,
    icon:          initial.icon,
    theme:         initial.theme,
    rarity:        initial.rarity as Rarity,
    isActive:      initial.isActive,
    shopCost:      (initial.shopCost as EffectBody["shopCost"]) ?? {},
    previewColors: (initial.previewColors as string[]) ?? [],
    config:        initial.config as EffectConfig,
  } : blankBody());

  const [generating, setGenerating]  = useState(false);
  const [genExtra,   setGenExtra]    = useState("");
  const [genError,   setGenError]    = useState<string | null>(null);
  const [saving,     setSaving]      = useState(false);
  const [saveError,  setSaveError]   = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const result = await api.generateEffectConfig({
        name: body.name || "Unnamed Effect",
        description: body.description,
        theme: body.theme,
        extra: genExtra,
      });
      setBody(b => ({ ...b, config: result.config }));
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(body);
      onClose();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold">{initial ? "Edit Effect" : "Create Profile Effect"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column: form */}
          <div className="space-y-5">
            {/* Basic info */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-20">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Icon</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-xl text-center bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
                    value={body.icon}
                    onChange={e => setBody(b => ({ ...b, icon: e.target.value }))}
                    maxLength={4}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Effect name *</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Enchanted Forest"
                    value={body.name}
                    onChange={e => setBody(b => ({ ...b, name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                <textarea
                  rows={2}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none resize-none"
                  placeholder="What does this effect evoke?"
                  value={body.description}
                  onChange={e => setBody(b => ({ ...b, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Theme</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
                    value={body.theme}
                    onChange={e => setBody(b => ({ ...b, theme: e.target.value }))}
                  >
                    {THEMES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rarity</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
                    value={body.rarity}
                    onChange={e => setBody(b => ({ ...b, rarity: e.target.value as Rarity }))}
                  >
                    {RARITIES.map(r => <option key={r} value={r}>{RARITY_META[r].label}</option>)}
                  </select>
                </div>
              </div>

              {/* Shop cost */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shop cost (0 = free)</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { key: "stars" as const, icon: "⭐", label: "Stars" },
                    { key: "aura"  as const, icon: "🔵", label: "Aura"  },
                    { key: "shards"as const, icon: "💎", label: "Shards" },
                  ].map(({ key, icon, label }) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground">{icon} {label}</label>
                      <input
                        type="number" min={0}
                        className="w-full mt-0.5 px-2 py-1.5 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none"
                        value={body.shopCost[key] ?? 0}
                        onChange={e => setBody(b => ({ ...b, shopCost: { ...b.shopCost, [key]: parseInt(e.target.value) || 0 } }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setBody(b => ({ ...b, isActive: !b.isActive }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${body.isActive ? "bg-primary" : "bg-muted"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${body.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-muted-foreground">{body.isActive ? "Active — visible in catalog" : "Inactive — hidden from catalog"}</span>
              </label>
            </div>

            {/* AI generation */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold">✨ Generate config with AI</span>
              </div>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:ring-1 focus:ring-primary outline-none resize-none mb-2"
                placeholder="Extra context for Claude (optional): 'Focus on fireflies + enchanted mushrooms, very slow and dreamy'"
                value={genExtra}
                onChange={e => setGenExtra(e.target.value)}
              />
              {genError && <p className="text-xs text-destructive mb-2">{genError}</p>}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !body.name}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {generating ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Generating…</>
                ) : (
                  "✨ Generate animation config"
                )}
              </button>
              <p className="text-xs text-muted-foreground mt-1.5">
                Claude will craft the particle config from your effect name, description, and theme.
              </p>
            </div>
          </div>

          {/* Right column: config + preview */}
          <div className="space-y-5">
            {/* Live preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live preview</span>
                <span className="text-xs text-muted-foreground">Updates as you edit</span>
              </div>
              <AnimatedPreview config={body.config} size="md" />
            </div>

            {/* Config editor */}
            <div className="border-t pt-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-3">Animation config</span>
              <ConfigEditor config={body.config} onChange={c => setBody(b => ({ ...b, config: c }))} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex items-center justify-between gap-3">
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !body.name}
              className="px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : initial ? "Save changes" : "Create effect"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Effect card ───────────────────────────────────────────────────────────────

function EffectCard({
  effect,
  onEdit,
  onDelete,
  onToggle,
}: {
  effect:   ProfileEffectRow;
  onEdit:   () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rarity = (effect.rarity as Rarity) ?? "common";
  const cost   = effect.shopCost as { stars?: number; aura?: number; shards?: number };

  return (
    <div className={`bg-card border-2 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow ${
      effect.isActive ? RARITY_META[rarity].glow : "border-muted opacity-60"
    }`}>
      {/* Preview */}
      <div className="p-3 bg-muted/30 flex items-center justify-center">
        <AnimatedPreview config={effect.config as EffectConfig} size="sm" />
      </div>

      {/* Info */}
      <div className="p-4 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{effect.icon}</span>
              <h3 className="font-semibold text-sm leading-tight">{effect.name}</h3>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${RARITY_META[rarity].color}`}>
              {RARITY_META[rarity].label}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${effect.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {effect.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {effect.description && (
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{effect.description}</p>
        )}

        {/* Particles preview */}
        <div className="flex items-center gap-1 flex-wrap">
          {(effect.config as EffectConfig).particles.slice(0, 6).map((p, i) => (
            <span key={i} className="text-base">{p}</span>
          ))}
          <span className="text-xs text-muted-foreground ml-1 capitalize">{(effect.config as EffectConfig).mode}</span>
        </div>

        {/* Cost */}
        <div className="text-xs text-muted-foreground">
          {(cost.stars || 0) > 0 && <span className="mr-2">⭐ {cost.stars}</span>}
          {(cost.aura  || 0) > 0 && <span className="mr-2">🔵 {cost.aura}</span>}
          {(cost.shards || 0) > 0 && <span className="mr-2">💎 {cost.shards}</span>}
          {!(cost.stars || cost.aura || cost.shards) && <span className="text-green-600">Free</span>}
        </div>

        <div className="text-xs text-muted-foreground">
          ID: <span className="font-mono">effect_custom_{effect.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t px-4 py-3 flex items-center gap-2">
        <button
          onClick={onToggle}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {effect.isActive ? "Deactivate" : "Activate"}
        </button>
        <div className="flex-1" />
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors"
        >
          Edit
        </button>
        {confirmDelete ? (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg"
          >
            Confirm delete
          </button>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EffectsPage() {
  const [effects,   setEffects]   = useState<ProfileEffectRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<ProfileEffectRow | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProfileEffects();
      setEffects(data.effects);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load effects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(body: EffectBody) {
    if (editing) {
      const updated = await api.updateProfileEffect(editing.id, body);
      setEffects(es => es.map(e => e.id === editing.id ? updated.effect : e));
    } else {
      const created = await api.createProfileEffect(body);
      setEffects(es => [created.effect, ...es]);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteProfileEffect(id);
    setEffects(es => es.filter(e => e.id !== id));
  }

  async function handleToggle(effect: ProfileEffectRow) {
    const updated = await api.updateProfileEffect(effect.id, {
      name: effect.name, description: effect.description, icon: effect.icon,
      theme: effect.theme, rarity: effect.rarity,
      config: effect.config as EffectConfig,
      isActive: !effect.isActive,
      shopCost: effect.shopCost as EffectBody["shopCost"],
      previewColors: (effect.previewColors as string[]) ?? [],
    });
    setEffects(es => es.map(e => e.id === effect.id ? updated.effect : e));
  }

  const active   = effects.filter(e => e.isActive);
  const inactive = effects.filter(e => !e.isActive);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Profile Effects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Discord-style animated overlays for user profiles — AI-generated, grantable via events or shop.
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          ✦ Create effect
        </button>
      </div>

      {/* How it works */}
      <div className="bg-muted/40 rounded-xl p-4 mb-6 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How it works</p>
        <p>1. Create an effect here with AI-generated animation config → it gets an ID like <code className="text-xs bg-muted px-1 rounded">effect_custom_abc123</code></p>
        <p>2. Set a shop cost (or free) → users can purchase it from the in-app shop automatically</p>
        <p>3. Or add the effect ID to an Event inventory to grant it to all users during an event</p>
        <p>4. Active effects appear on user profiles as animated particle overlays in real-time</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm mb-6">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : effects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-5xl mb-3">✦</div>
          <p className="font-medium text-foreground">No effects yet</p>
          <p className="text-sm mt-1">Create your first AI-generated profile effect</p>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Active — {active.length} effect{active.length !== 1 ? "s" : ""}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {active.map(e => (
                  <EffectCard
                    key={e.id}
                    effect={e}
                    onEdit={() => { setEditing(e); setShowModal(true); }}
                    onDelete={() => handleDelete(e.id)}
                    onToggle={() => handleToggle(e)}
                  />
                ))}
              </div>
            </section>
          )}

          {inactive.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Inactive — {inactive.length} effect{inactive.length !== 1 ? "s" : ""}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {inactive.map(e => (
                  <EffectCard
                    key={e.id}
                    effect={e}
                    onEdit={() => { setEditing(e); setShowModal(true); }}
                    onDelete={() => handleDelete(e.id)}
                    onToggle={() => handleToggle(e)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showModal && (
        <EffectModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
        />
      )}
    </div>
  );
}
