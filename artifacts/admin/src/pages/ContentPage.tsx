import { useEffect, useState, useCallback, useRef } from "react";
import { api, type ContentItem, type StoryPanel } from "../api";
import UserDetailDrawer from "../components/UserDetailDrawer";

export default function ContentPage() {
  const [contentType, setContentType] = useState<"stories" | "outfits">("stories");
  const [items, setItems]   = useState<ContentItem[]>([]);
  const [total, setTotal]   = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const [authorSearch, setAuthorSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirm, setConfirm] = useState<{ action: "hide" | "unhide" | "delete"; item: ContentItem } | null>(null);
  const [toast, setToast]   = useState("");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ContentItem | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async (
    type: "stories" | "outfits",
    off: number,
    q: string,
    from: string,
    to: string,
  ) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getContent(type, off, q, from, to);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(contentType, offset, authorSearch, dateFrom, dateTo);
  }, [contentType, offset, dateFrom, dateTo]);

  const onAuthorChange = (v: string) => {
    setAuthorSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      load(contentType, 0, v, dateFrom, dateTo);
    }, 400);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === "hide")   await api.hideContent(contentType, confirm.item.id);
      if (confirm.action === "unhide") await api.unhideContent(contentType, confirm.item.id);
      if (confirm.action === "delete") await api.deleteContent(contentType, confirm.item.id);
      showToast("Done!");
      setConfirm(null);
      load(contentType, offset, authorSearch, dateFrom, dateTo);
    } catch (e: any) {
      showToast("Error: " + e.message);
      setConfirm(null);
    }
  };

  const switchType = (t: "stories" | "outfits") => {
    setContentType(t);
    setOffset(0);
  };

  const clearFilters = () => {
    setAuthorSearch("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  };

  const hasFilters = authorSearch || dateFrom || dateTo;

  const thumbnailUri = (item: ContentItem): string | null => {
    if (contentType === "outfits") return item.imageUri ?? null;
    const panels = item.panels ?? [];
    for (const p of panels) { if (p.imageUri) return p.imageUri; }
    return null;
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Content Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and moderate user-generated content</p>
      </div>

      {/* Type tabs + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => switchType("stories")}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${contentType === "stories" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
          >Stories</button>
          <button
            onClick={() => switchType("outfits")}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${contentType === "outfits" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
          >Outfits</button>
        </div>

        {/* Author search */}
        <input
          type="search"
          placeholder="Filter by author name or @username…"
          className="border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring w-64"
          value={authorSearch}
          onChange={e => onAuthorChange(e.target.value)}
        />

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
          <input
            type="date"
            className="border rounded-lg px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setOffset(0); }}
          />
          <label className="text-xs text-muted-foreground">to</label>
          <input
            type="date"
            className="border rounded-lg px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setOffset(0); }}
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-2 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors text-muted-foreground"
              title="Clear all filters"
            >✕ Clear</button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
          <span className="text-sm font-medium">
            {total.toLocaleString()} {contentType}
            {hasFilters && <span className="ml-2 text-muted-foreground text-xs">(filtered)</span>}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-16">Preview</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Author</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {hasFilters ? "No content matches your filters." : "No content found."}
                  </td>
                </tr>
              ) : items.map((item) => {
                const thumb = thumbnailUri(item);
                return (
                  <tr key={item.id} className="border-b hover:bg-muted/20 transition-colors">
                    {/* Thumbnail */}
                    <td className="px-4 py-2">
                      <div
                        className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center cursor-pointer border hover:border-primary transition-colors flex-shrink-0"
                        onClick={() => setPreview(item)}
                        title="Preview content"
                      >
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg text-muted-foreground">
                            {contentType === "stories" ? "📖" : "👗"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3">
                      <button
                        className="text-left hover:underline font-medium line-clamp-1"
                        onClick={() => setPreview(item)}
                      >
                        {item.chapterTitle ?? item.name ?? "—"}
                      </button>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                        {item.mood && <span className="text-xs text-muted-foreground">{item.mood}</span>}
                        {contentType === "stories" && item.panels && (
                          <span className="text-xs text-muted-foreground">{item.panels.length} panel{item.panels.length !== 1 ? "s" : ""}</span>
                        )}
                        {contentType === "stories" && (item.witnessedCount ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground">👁 {item.witnessedCount}</span>
                        )}
                        {item.tags && item.tags.length > 0 && (
                          <span className="text-xs text-muted-foreground">{item.tags.slice(0, 3).join(", ")}</span>
                        )}
                      </div>
                    </td>

                    {/* Author */}
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{item.authorName ?? "Unknown"}</div>
                      {item.username && <div className="text-xs">@{item.username}</div>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {item.isHidden  && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Hidden</span>}
                        {item.isPublic  && !item.isHidden && <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Public</span>}
                        {!item.isPublic && !item.isHidden && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-medium">Private</span>}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <button
                          onClick={() => setPreview(item)}
                          className="px-2 py-1 text-xs rounded-md font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border"
                        >View</button>
                        <button
                          onClick={() => setDetailUserId(item.userId)}
                          className="px-2 py-1 text-xs rounded-md font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                        >Author</button>
                        <button
                          onClick={() => setConfirm({ action: item.isHidden ? "unhide" : "hide", item })}
                          className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${item.isHidden ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}
                        >{item.isHidden ? "Unhide" : "Hide"}</button>
                        <button
                          onClick={() => setConfirm({ action: "delete", item })}
                          className="px-2 py-1 text-xs rounded-md font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <span className="text-sm text-muted-foreground">{offset + 1}–{Math.min(offset + 50, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - 50))} disabled={offset === 0}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-muted">← Prev</button>
              <button onClick={() => setOffset(offset + 50)} disabled={offset + 50 >= total}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-muted">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Content Preview Modal ───────────────────────────────────────────── */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl border shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg leading-snug truncate">
                  {preview.chapterTitle ?? preview.name ?? "Untitled"}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {preview.authorName && (
                    <span className="text-sm text-muted-foreground">by {preview.authorName}{preview.username ? ` (@${preview.username})` : ""}</span>
                  )}
                  {preview.mood && <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">{preview.mood}</span>}
                  {preview.isHidden && <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">Hidden</span>}
                  {preview.isPublic && !preview.isHidden && <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium">Public</span>}
                  {!preview.isPublic && !preview.isHidden && <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">Private</span>}
                </div>
              </div>
              <button onClick={() => setPreview(null)} className="ml-4 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground flex-shrink-0">✕</button>
            </div>

            {contentType === "stories" && preview.panels && preview.panels.length > 0 && (
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {preview.panels.map((panel: StoryPanel, i: number) => (
                  <div key={i} className="rounded-xl border overflow-hidden bg-muted/30">
                    {panel.imageUri && (
                      <img src={panel.imageUri} alt={`Panel ${i + 1}`} className="w-full object-cover max-h-72"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    {(panel.text || panel.bubbleText) && (
                      <div className="p-3 space-y-1">
                        {panel.text && <p className="text-sm leading-relaxed">{panel.text}</p>}
                        {panel.bubbleText && (
                          <p className="text-sm italic text-muted-foreground bg-background rounded-lg px-3 py-2 border">"{panel.bubbleText}"</p>
                        )}
                      </div>
                    )}
                    {!panel.imageUri && !panel.text && !panel.bubbleText && (
                      <div className="p-4 text-center text-sm text-muted-foreground">Empty panel</div>
                    )}
                    <div className="px-3 py-1.5 border-t bg-muted/20">
                      <span className="text-xs text-muted-foreground font-medium">Panel {i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contentType === "outfits" && (
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {preview.imageUri ? (
                  <img src={preview.imageUri} alt={preview.name} className="w-full max-h-80 object-contain rounded-xl border bg-muted/20"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="h-32 rounded-xl border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">No image</div>
                )}
                {preview.description && <p className="text-sm text-muted-foreground leading-relaxed">{preview.description}</p>}
                {preview.tags && preview.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.tags.map((tag: string) => (
                      <span key={tag} className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between p-4 border-t bg-muted/20">
              <div className="text-xs text-muted-foreground">
                {new Date(preview.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                {(preview.witnessedCount ?? 0) > 0 && <span className="ml-3">👁 {preview.witnessedCount} witnessed</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setDetailUserId(preview.userId); setPreview(null); }}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors">Author</button>
                <button onClick={() => { setConfirm({ action: preview.isHidden ? "unhide" : "hide", item: preview }); setPreview(null); }}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${preview.isHidden ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}>
                  {preview.isHidden ? "Unhide" : "Hide"}
                </button>
                <button onClick={() => { setConfirm({ action: "delete", item: preview }); setPreview(null); }}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm modal ─────────────────────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-lg capitalize">{confirm.action} Content</h3>
            <p className="text-sm text-muted-foreground">
              {confirm.action === "delete"
                ? `Permanently delete "${confirm.item.chapterTitle ?? confirm.item.name}"? This cannot be undone.`
                : confirm.action === "hide"
                ? `Hide "${confirm.item.chapterTitle ?? confirm.item.name}" from all feeds?`
                : `Unhide "${confirm.item.chapterTitle ?? confirm.item.name}"?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 ${confirm.action === "delete" ? "bg-red-600" : "bg-primary"}`}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}

      <UserDetailDrawer userId={detailUserId} onClose={() => setDetailUserId(null)} />
    </div>
  );
}
