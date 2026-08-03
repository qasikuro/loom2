import { useEffect, useRef, useState } from "react";
import { api, type AdminBadge, type BadgeBody } from "../api";

const DEFAULT_FORM: BadgeBody = {
  slug: "", name: "", emoji: "🏅", color: "#6366f1", description: "", imageUrl: null, sortOrder: 0,
};

export default function BadgesPage() {
  const [badges, setBadges]         = useState<AdminBadge[]>([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState("");
  const [modal, setModal]           = useState<"create" | "edit" | null>(null);
  const [editing, setEditing]       = useState<AdminBadge | null>(null);
  const [form, setForm]             = useState<BadgeBody>(DEFAULT_FORM);
  const [saving, setSaving]         = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [confirm, setConfirm]       = useState<AdminBadge | null>(null);
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

  const openCreate = () => { setEditing(null); setForm(DEFAULT_FORM); setModal("create"); };
  const openEdit   = (b: AdminBadge) => {
    setEditing(b);
    setForm({ slug: b.slug, name: b.name, emoji: "🏅", color: "#6366f1", description: b.description, imageUrl: b.imageUrl, sortOrder: b.sortOrder });
    setModal("edit");
  };

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

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
    if (!form.name.trim()) { showToast("Name is required."); return; }
    const slug = form.slug || slugify(form.name);
    if (!slug) { showToast("Could not derive a slug from the name."); return; }
    setSaving(true);
    try {
      if (modal === "create") {
        const { badge } = await api.createBadge({ ...form, slug });
        setBadges(prev => [...prev, badge]);
        showToast(`"${badge.name}" created!`);
      } else if (editing) {
        const { badge } = await api.updateBadge(editing.id, form);
        setBadges(prev => prev.map(b => b.id === badge.id ? badge : b));
        showToast(`"${badge.name}" updated!`);
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Badges</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Badges you create here can be granted to users from their profile drawer.</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          + New Badge
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : badges.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-4xl mb-3">🏅</div>
          <div className="font-medium">No badges yet</div>
          <div className="text-sm mt-1">Create your first badge above.</div>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Badge</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Slug</th>
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
                        <img src={b.imageUrl} alt={b.name} className="w-10 h-10 rounded-lg object-contain border bg-muted/20" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted/40 border flex items-center justify-center text-muted-foreground text-xs font-bold">
                          {b.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">{b.name}</div>
                        {b.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{b.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs text-muted-foreground">{b.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-muted rounded-full text-xs font-semibold">
                      {b.holderCount ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(b)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors font-medium">
                        Edit
                      </button>
                      <button onClick={() => setConfirm(b)} className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium">
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

      {/* Delete confirm */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-xl p-6 max-w-sm w-full border">
            <h3 className="font-bold text-base mb-2">Delete "{confirm.name}"?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              This removes the badge from all users currently holding it. This cannot be undone.
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
          <div className="bg-background rounded-2xl shadow-xl max-w-sm w-full border overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="font-bold text-base">{modal === "create" ? "New Badge" : `Edit: ${editing?.name}`}</h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Badge Name</label>
                <input
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
                  placeholder="e.g. Early Adopter"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: modal === "create" ? slugify(e.target.value) : f.slug }))}
                  autoFocus
                />
              </div>

              {/* Slug (create only, auto-derived, still editable) */}
              {modal === "create" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Slug</label>
                  <input
                    className="w-full border rounded-xl px-3 py-2 text-sm font-mono bg-background"
                    placeholder="auto-generated"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Description <span className="normal-case font-normal">(optional)</span></label>
                <textarea
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background resize-none"
                  rows={2}
                  placeholder="Shown on the badge tooltip."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Image */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Badge Image</label>
                {form.imageUrl && (
                  <div className="flex items-center gap-3 mb-2">
                    <img src={form.imageUrl} alt="badge" className="w-12 h-12 rounded-lg border object-contain bg-muted/20" />
                    <button onClick={() => setForm(f => ({ ...f, imageUrl: null }))} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={imgLoading}
                  className="w-full py-3 border-2 border-dashed rounded-xl text-sm text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
                >
                  {imgLoading ? "Uploading…" : (form.imageUrl ? "Replace image" : "Click to upload image")}
                </button>
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
            </div>

            <div className="px-5 py-4 border-t bg-muted/20 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border rounded-xl hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : modal === "create" ? "Create" : "Save"}
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
