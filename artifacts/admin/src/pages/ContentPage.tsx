import { useEffect, useState, useCallback } from "react";
import { api, type ContentItem } from "../api";

export default function ContentPage() {
  const [contentType, setContentType] = useState<"stories" | "outfits">("stories");
  const [items, setItems]   = useState<ContentItem[]>([]);
  const [total, setTotal]   = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [confirm, setConfirm] = useState<{ action: "hide" | "unhide" | "delete"; item: ContentItem } | null>(null);
  const [toast, setToast]   = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async (type: "stories" | "outfits", off: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getContent(type, off);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(contentType, offset); }, [contentType, offset]);

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === "hide")   await api.hideContent(contentType, confirm.item.id);
      if (confirm.action === "unhide") await api.unhideContent(contentType, confirm.item.id);
      if (confirm.action === "delete") await api.deleteContent(contentType, confirm.item.id);
      showToast("Done!");
      setConfirm(null);
      load(contentType, offset);
    } catch (e: any) {
      showToast("Error: " + e.message);
      setConfirm(null);
    }
  };

  const switchType = (t: "stories" | "outfits") => {
    setContentType(t);
    setOffset(0);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Content Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and moderate user-generated content</p>
      </div>

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

      {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
          <span className="text-sm font-medium">{total.toLocaleString()} {contentType}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
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
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No content found</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium line-clamp-1">{item.chapterTitle ?? item.name ?? "—"}</div>
                    {item.mood && <div className="text-xs text-muted-foreground">{item.mood}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{item.authorName ?? "Unknown"}</div>
                    {item.username && <div className="text-xs">@{item.username}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {item.isHidden  && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Hidden</span>}
                      {item.isPublic  && !item.isHidden && <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Public</span>}
                      {!item.isPublic && !item.isHidden && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-medium">Private</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setConfirm({ action: item.isHidden ? "unhide" : "hide", item })}
                        className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${item.isHidden ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}
                      >
                        {item.isHidden ? "Unhide" : "Hide"}
                      </button>
                      <button
                        onClick={() => setConfirm({ action: "delete", item })}
                        className="px-2 py-1 text-xs rounded-md font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
