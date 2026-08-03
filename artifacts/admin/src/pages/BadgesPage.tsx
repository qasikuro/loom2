import { useEffect, useRef, useState } from "react";
import { api, type AdminBadge, type BadgeBody } from "../api";

const PRESET_COLORS = [
  "#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#ef4444",
  "#f97316", "#06b6d4", "#ec4899", "#6366f1", "#84cc16",
];

const DEFAULT_FORM: BadgeBody = {
  slug: "", name: "", emoji: "🏅", color: "#6366f1", description: "", imageUrl: null, sortOrder: 0,
};

export default function BadgesPage() {
  const [badges, setBadges]     = useState<AdminBadge[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState("");
  const [modal, setModal]       = useState<"create" | "edit" | null>(null);
  const [editing, setEditing]   = useState<AdminBadge | null>(null);
  const [form, setForm]         = useState<BadgeBody>(DEFAULT_FORM);
  const [saving, setSaving]     = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [confirm, setConfirm]   = useState<AdminBadge | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = () => {
    setLoading(true);
    api.getBadges()
      .then(d => setBadges(d.badges))
      .catch(e => showToast("Error: " + e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setModal("create");
  };

  const openEdit = (b: AdminBadge) => {
    setEditing(b);
    setForm({ slug: b.slug, name: b.name, emoji: b.emoji, color: b.color, description: b.description, imageUrl: b.imageUrl, sortOrder: b.sortOrder });
    setModal("edit");
  };

  const handleImageUpload = async (file: File) => {
    setImgLoading(true);
    try {
      const { uploadUrl, servingUrl } = await api.getBadgeUploadUrl();
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setForm(f => ({ ...f, imageUrl: servingUrl }));
      showToast("Image uploaded ✓");
    } catch (e: unknown) {
      showToast("Upload failed: " + (e as Error).message);
    } finally {
      setImgLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.slug || !form.name || !form.emoji || !form.color) {
      showToast("Slug, name, emoji, and color are required."); return;
    }
    setSaving(true);
    try {
      if (modal === "create") {
        const { badge } = await api.createBadge(form);
        setBadges(prev => [...prev, badge]);
        showToast(`Badge "${badge.name}" created!`);
      } else if (editing) {
        const { badge } = await api.updateBadge(editing.id, form);
        setBadges(prev => prev.map(b => b.id === badge.id ? badge : b));
        showToast(`Badge "${badge.name}" updated!`);
      }
      setModal(null);
    } catch (e: unknown) {
      showToast("Save failed: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (badge: AdminBadge) => {
    try {
      await api.deleteBadge(badge.id);
      setBadges(prev => prev.filter(b => b.id !== badge.id));
      setConfirm(null);
      showToast(`"${badge.name}" deleted.`);
    } catch (e: unknown) {
      showToast("Delete failed: " + (e as Error).message);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Badges</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage badges that can be granted to users.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          + New Badge
        </button>
      </div>

      {/* Badge table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : badges.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-4xl mb-3">🏅</div>
          <div className="font-medium">No badges yet</div>
          <div className="text-sm mt-1">Create a badge above and assign it to users from their profile drawer.</div>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Badge</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Slug</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Color</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Holders</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {badges.map(b => (
                <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {b.imageUrl ? (
                        <img src={b.imageUrl} alt={b.name} className="w-9 h-9 rounded-lg object-contain border" />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-xl border"
                          style={{ backgroundColor: b.color + "22", borderColor: b.color + "55" }}
                        >
                          {b.emoji}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">{b.name}</div>
                        {b.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-block w-6 h-6 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: b.color }}
                      title={b.color}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-muted rounded-full text-xs font-semibold">
                      {b.holderCount ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(b)}
                        className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirm(b)}
                        className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-xl p-6 max-w-sm w-full border">
            <h3 className="font-bold text-base mb-2">Delete "{confirm.name}"?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              This will remove the badge from all users who currently hold it. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 px-4 py-2 text-sm border rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirm)} className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-xl max-w-lg w-full border overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="font-bold text-base">{modal === "create" ? "New Badge" : `Edit: ${editing?.name}`}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Preview */}
              <div className="flex justify-center">
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-full border"
                  style={{ backgroundColor: form.color + "22", borderColor: form.color + "55" }}
                >
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="w-7 h-7 rounded object-contain" />
                  ) : (
                    <span>{form.emoji || "🏅"}</span>
                  )}
                  <span className="font-semibold text-sm" style={{ color: form.color }}>
                    {form.name || "Badge preview"}
                  </span>
                </div>
              </div>

              {/* Slug */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Slug (unique, no spaces)</label>
                <input
                  className="w-full border rounded-xl px-3 py-2 text-sm font-mono bg-background"
                  placeholder="e.g. early_adopter"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))}
                  disabled={modal === "edit"} // slug is immutable after creation
                />
                {modal === "edit" && <p className="text-xs text-muted-foreground mt-1">Slug cannot be changed after creation.</p>}
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Display Name</label>
                <input
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
                  placeholder="e.g. Early Adopter"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Emoji */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Emoji Fallback</label>
                <input
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
                  placeholder="🏅"
                  value={form.emoji}
                  maxLength={2}
                  onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                />
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-9 h-9 rounded-lg border cursor-pointer"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ backgroundColor: c, borderColor: form.color === c ? "#000" : "transparent" }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Description (optional)</label>
                <textarea
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background resize-none"
                  rows={2}
                  placeholder="Shown when hovering or in badge details."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Sort order */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Sort Order</label>
                <input
                  type="number"
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
                  value={form.sortOrder ?? 0}
                  onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>

              {/* Image upload */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Badge Image (optional)</label>
                {form.imageUrl && (
                  <div className="flex items-center gap-3 mb-2">
                    <img src={form.imageUrl} alt="badge" className="w-12 h-12 rounded-lg border object-contain" />
                    <button
                      onClick={() => setForm(f => ({ ...f, imageUrl: null }))}
                      className="text-xs text-red-600 hover:underline"
                    >Remove</button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={imgLoading}
                  className="w-full py-2.5 border-2 border-dashed rounded-xl text-sm text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
                >
                  {imgLoading ? "Uploading…" : "Click to upload image"}
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-muted/20 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : modal === "create" ? "Create Badge" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-[60]">
          {toast}
        </div>
      )}
    </div>
  );
}
