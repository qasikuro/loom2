import { useEffect, useState, useCallback } from "react";
import { api, type AdminUser } from "../api";
import UserDetailDrawer from "../components/UserDetailDrawer";

type ConfirmAction = { type: "ban" | "unban" | "delete" | "admin"; user: AdminUser };
type LimitEdit     = { userId: string; value: string };

function fmtDate(ts: number | string | null | undefined, fallback = "—") {
  if (!ts) return fallback;
  return new Date(Number(ts)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(ts: number | null | undefined) {
  if (!ts) return null;
  const diffMs  = Date.now() - Number(ts);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30)  return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function UsersPage() {
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [total, setTotal]     = useState(0);
  const [query, setQuery]     = useState("");
  const [offset, setOffset]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [toast, setToast]     = useState("");
  const [limitEdit, setLimitEdit] = useState<LimitEdit | null>(null);
  const [limitSaving, setLimitSaving] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async (q: string, off: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getUsers(q, off);
      setUsers(data.users);
      setTotal(data.total);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(query, offset); }, [query, offset]);

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === "ban")    await api.banUser(confirm.user.userId);
      if (confirm.type === "unban")  await api.unbanUser(confirm.user.userId);
      if (confirm.type === "delete") await api.deleteUser(confirm.user.userId);
      if (confirm.type === "admin")  await api.toggleAdmin(confirm.user.userId);
      showToast("Done!");
      setConfirm(null);
      load(query, offset);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      showToast("Error: " + e.message);
      setConfirm(null);
    }
  };

  const handleSaveLimit = async () => {
    if (!limitEdit) return;
    const n = parseInt(limitEdit.value, 10);
    if (isNaN(n) || n < 1 || n > 50000) {
      showToast("Enter a number between 1 and 50,000");
      return;
    }
    setLimitSaving(true);
    try {
      await api.setGalleryLimit(limitEdit.userId, n);
      setUsers(prev => prev.map(u => u.userId === limitEdit.userId ? { ...u, galleryLimit: n } : u));
      showToast(`Gallery limit set to ${n}`);
      setLimitEdit(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      showToast("Error: " + e.message);
    } finally {
      setLimitSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total users</p>
        </div>
        <input
          type="search"
          placeholder="Search by name or username…"
          className="border rounded-lg px-3 py-2 text-sm w-64 bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOffset(0); }}
        />
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Sign-in</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gallery Limit</th>
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
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
              ) : users.map((u) => {
                const relative = fmtRelative(u.lastSignInAt);
                const absolute = fmtDate(u.lastSignInAt);
                return (
                  <tr key={u.userId} className="border-b hover:bg-muted/20 transition-colors">
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.username ? `@${u.username}` : <span className="italic opacity-60">no username</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 font-mono">{u.userId.slice(0, 20)}…</div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      {u.email ? (
                        <a
                          href={`mailto:${u.email}?subject=Sky Journal Support`}
                          className="text-blue-600 hover:underline text-xs break-all"
                          title="Send email"
                        >{u.email}</a>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.isAdmin  && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">Admin</span>}
                        {u.isBanned && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Banned</span>}
                        {!u.isAdmin && !u.isBanned && <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Active</span>}
                        {!u.isPublic && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-medium">Private</span>}
                      </div>
                    </td>

                    {/* Last Sign-in */}
                    <td className="px-4 py-3">
                      {u.lastSignInAt ? (
                        <div>
                          <div className="text-xs font-medium">{relative}</div>
                          <div className="text-[10px] text-muted-foreground">{absolute}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">Never</span>
                      )}
                    </td>

                    {/* Gallery Limit */}
                    <td className="px-4 py-3">
                      {limitEdit?.userId === u.userId ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={50000}
                            className="w-20 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            value={limitEdit.value}
                            onChange={e => setLimitEdit({ userId: u.userId, value: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") handleSaveLimit(); if (e.key === "Escape") setLimitEdit(null); }}
                            autoFocus
                          />
                          <button
                            onClick={handleSaveLimit}
                            disabled={limitSaving}
                            className="px-2 py-1 text-xs rounded bg-primary text-white font-medium disabled:opacity-50"
                          >{limitSaving ? "…" : "Save"}</button>
                          <button
                            onClick={() => setLimitEdit(null)}
                            className="px-2 py-1 text-xs rounded border hover:bg-muted"
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setLimitEdit({ userId: u.userId, value: String(u.galleryLimit ?? 200) })}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground group"
                        >
                          <span className="font-medium tabular-nums">{u.galleryLimit ?? 200}</span>
                          <span className="opacity-0 group-hover:opacity-60 transition-opacity text-[10px]">✏</span>
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <button
                          onClick={() => setDetailUserId(u.userId)}
                          className="px-2 py-1 text-xs rounded-md font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                        >View</button>
                        <button
                          onClick={() => setConfirm({ type: u.isBanned ? "unban" : "ban", user: u })}
                          className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${u.isBanned ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}
                        >{u.isBanned ? "Unban" : "Ban"}</button>
                        <button
                          onClick={() => setConfirm({ type: "admin", user: u })}
                          className="px-2 py-1 text-xs rounded-md font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                        >{u.isAdmin ? "Demote" : "Promote"}</button>
                        <button
                          onClick={() => setConfirm({ type: "delete", user: u })}
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
            <span className="text-sm text-muted-foreground">
              {offset + 1}–{Math.min(offset + 50, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - 50))}
                disabled={offset === 0}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-muted transition-colors"
              >← Prev</button>
              <button
                onClick={() => setOffset(offset + 50)}
                disabled={offset + 50 >= total}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-muted transition-colors"
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-lg capitalize">
              {confirm.type === "admin" ? (confirm.user.isAdmin ? "Demote from Admin" : "Promote to Admin") : `${confirm.type} User`}
            </h3>
            <p className="text-sm text-muted-foreground">
              {confirm.type === "delete"
                ? `This will permanently delete ${confirm.user.name} and all their content. This cannot be undone.`
                : confirm.type === "ban"
                ? `Ban ${confirm.user.name}? Their content will be hidden from the discover feed.`
                : confirm.type === "unban"
                ? `Unban ${confirm.user.name}? They will regain full access.`
                : confirm.user.isAdmin
                ? `Remove admin access from ${confirm.user.name}?`
                : `Grant admin access to ${confirm.user.name}?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors"
              >Cancel</button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm rounded-lg font-medium text-white transition-opacity hover:opacity-90 ${confirm.type === "delete" ? "bg-red-600" : confirm.type === "ban" ? "bg-orange-600" : "bg-primary"}`}
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

      <UserDetailDrawer
        userId={detailUserId}
        onClose={() => setDetailUserId(null)}
        onActionDone={() => load(query, offset)}
      />
    </div>
  );
}
