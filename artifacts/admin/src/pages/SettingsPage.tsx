import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../api";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { AlertTriangle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Features {
  stories:       boolean;
  music:         boolean;
  shop:          boolean;
  season:        boolean;
  campfire:      boolean;
  guides:        boolean;
  notifications: boolean;
}

interface Settings {
  maintenance_mode: boolean;
  min_app_version:  string;
  features:         Features;
}

const DEFAULT_FEATURES: Features = {
  stories:       true,
  music:         true,
  shop:          true,
  season:        true,
  campfire:      true,
  guides:        true,
  notifications: true,
};

const FEATURE_LABELS: Record<keyof Features, string> = {
  stories:       "Stories",
  music:         "Music",
  shop:          "Shop",
  season:        "Season",
  campfire:      "Campfire",
  guides:        "Guides",
  notifications: "Notifications",
};

// ── Helper ────────────────────────────────────────────────────────────────────

async function saveSetting(key: string, value: unknown) {
  await apiFetch(`/admin/settings/${key}`, {
    method: "PUT",
    body:   JSON.stringify({ value }),
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved,  setSaved]      = useState<string | null>(null);
  const [error,  setError]      = useState<string | null>(null);
  const [versionDraft, setVersionDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { settings: s } = await apiFetch<{ settings: Settings }>("/admin/settings");
      setSettings(s);
      setVersionDraft(s.min_app_version ?? "1.0.0");
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (key: string) => {
    setSaved(key);
    setTimeout(() => setSaved(null), 1800);
  };

  const toggleMaintenance = async (val: boolean) => {
    if (!settings) return;
    setSaving("maintenance_mode");
    try {
      await saveSetting("maintenance_mode", val);
      setSettings({ ...settings, maintenance_mode: val });
      flash("maintenance_mode");
    } catch { setError("Save failed"); }
    finally   { setSaving(null); }
  };

  const saveVersion = async () => {
    if (!settings) return;
    const trimmed = versionDraft.trim();
    if (!trimmed) return;
    setSaving("min_app_version");
    try {
      await saveSetting("min_app_version", trimmed);
      setSettings({ ...settings, min_app_version: trimmed });
      flash("min_app_version");
    } catch { setError("Save failed"); }
    finally   { setSaving(null); }
  };

  const toggleFeature = async (key: keyof Features, val: boolean) => {
    if (!settings) return;
    const updated = { ...settings.features, [key]: val };
    setSaving(`feature_${key}`);
    try {
      await saveSetting("features", updated);
      setSettings({ ...settings, features: updated });
      flash(`feature_${key}`);
    } catch { setError("Save failed"); }
    finally   { setSaving(null); }
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-muted-foreground">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Loading settings…
    </div>
  );

  if (error) return (
    <div className="p-8 text-destructive">{error}</div>
  );

  const features = { ...DEFAULT_FEATURES, ...(settings?.features ?? {}) };

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control app behaviour without releasing a new build.
        </p>
      </div>

      {/* ── Maintenance Mode ── */}
      <section className="bg-card border rounded-xl divide-y">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Maintenance
          </h2>
        </div>
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Maintenance Mode</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shows a maintenance screen to all users until you turn it off.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved === "maintenance_mode" && (
              <span className="text-xs text-green-600">Saved</span>
            )}
            <Switch
              checked={settings?.maintenance_mode ?? false}
              disabled={saving === "maintenance_mode"}
              onCheckedChange={toggleMaintenance}
              className={settings?.maintenance_mode ? "data-[state=checked]:bg-destructive" : ""}
            />
          </div>
        </div>
        {settings?.maintenance_mode && (
          <div className="px-5 py-3 bg-destructive/10">
            <p className="text-xs text-destructive font-medium">
              <span className="inline-flex items-center gap-1.5"><AlertTriangle size={13} />Maintenance mode is ON — users see a maintenance screen right now.</span>
            </p>
          </div>
        )}
      </section>

      {/* ── Minimum App Version ── */}
      <section className="bg-card border rounded-xl divide-y">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            App Version
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Minimum Required Version</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Users below this version see an "update required" screen.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              className="w-36 font-mono text-sm"
              placeholder="1.0.0"
              value={versionDraft}
              onChange={e => setVersionDraft(e.target.value)}
            />
            <Button
              size="sm"
              disabled={saving === "min_app_version" || versionDraft === settings?.min_app_version}
              onClick={saveVersion}
            >
              {saving === "min_app_version" ? "Saving…" : "Save"}
            </Button>
            {saved === "min_app_version" && (
              <span className="text-xs text-green-600">Saved</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Feature Flags ── */}
      <section className="bg-card border rounded-xl divide-y">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Feature Flags
          </h2>
        </div>
        {(Object.keys(FEATURE_LABELS) as (keyof Features)[]).map(key => (
          <div key={key} className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{FEATURE_LABELS[key]}</p>
              <p className="text-xs text-muted-foreground">
                {features[key] ? "Visible to all users" : "Hidden from all users"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saved === `feature_${key}` && (
                <span className="text-xs text-green-600">Saved</span>
              )}
              <Switch
                checked={features[key] ?? true}
                disabled={saving === `feature_${key}`}
                onCheckedChange={val => toggleFeature(key, val)}
              />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
