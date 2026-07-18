import { useEffect, useState } from "react";
import { api, type AdminUserDetail } from "../api";

interface Props {
  userId: string | null;
  onClose: () => void;
  onActionDone?: () => void;
}

type ConfirmKind = "ban" | "unban" | "delete" | "admin";

export default function UserDetailDrawer({ userId, onClose, onActionDone }: Props) {
  const [user, setUser]       = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [toast, setToast]     = useState("");
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [copied, setCopied]   = useState(false);

  const [limitMode, setLimitMode]   = useState(false);
  const [limitVal, setLimitVal]     = useState("");
  const [limitSaving, setLimitSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    if (!userId) { setUser(null); return; }
    setLoading(true);
    setError("");
    setConfirm(null);
    setLimitMode(false);
    api.getUserDetail(userId)
      .then(d => { setUser(d); setLimitVal(String(d.galleryLimit ?? 200)); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleAction = async (kind: ConfirmKind) => {
    if (!user) return;
    try {
      if (kind === "ban")    await api.banUser(user.userId);
      if (kind === "unban")  await api.unbanUser(user.userId);
      if (kind === "delete") { await api.deleteUser(user.userId); onClose(); onActionDone?.(); return; }
      if (kind === "admin")  await api.toggleAdmin(user.userId);
      const fresh = await api.getUserDetail(user.userId);
      setUser(fresh);
      showToast("Done!");
      setConfirm(null);
      onActionDone?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      showToast("Error: " + e.message);
      setConfirm(null);
    }
  };

  const handleSaveLimit = async () => {
    if (!user) return;
    const n = parseInt(limitVal, 10);
    if (isNaN(n) || n < 1 || n > 50000) { showToast("Enter 1–50,000"); return; }
    setLimitSaving(true);
    try {
      await api.setGalleryLimit(user.userId, n);
      setUser(prev => prev ? { ...prev, galleryLimit: n } : prev);
      setLimitMode(false);
      showToast("Gallery limit updated");
      onActionDone?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      showToast("Error: " + e.message);
    } finally {
      setLimitSaving(false);
    }
  };

  const copyEmail = () => {
    if (!user?.email) return;
    navigator.clipboard.writeText(user.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!userId) return null;

  const initials = user?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  const joinDate  = user?.clerkCreatedAt ? new Date(user.clerkCreatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const lastActive = user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <span className="font-semibold text-sm">User Profile</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="m-5 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          ) : user ? (
            <div className="divide-y">

              {/* Identity */}
              <div className="px-5 py-5 flex gap-4 items-start">
                <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-semibold text-primary">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base leading-tight">{user.name || <span className="text-muted-foreground italic">No name</span>}</div>
                  {user.username && <div className="text-sm text-muted-foreground mt-0.5">@{user.username}</div>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {user.isAdmin  && <Badge color="purple">Admin</Badge>}
                    {user.isBanned && <Badge color="red">Banned</Badge>}
                    {!user.isAdmin && !user.isBanned && <Badge color="green">Active</Badge>}
                    {!user.isPublic && <Badge color="gray">Private</Badge>}
                  </div>
                </div>
              </div>

              {/* Email — the CRM hook */}
              <div className="px-5 py-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Email / Contact</div>
                {user.email ? (
                  <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5 border">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <span className="text-sm flex-1 truncate font-mono">{user.email}</span>
                    <button
                      onClick={copyEmail}
                      className="px-2 py-1 text-xs rounded-md border bg-background hover:bg-muted transition-colors flex-shrink-0"
                    >{copied ? "✓ Copied" : "Copy"}</button>
                    <a
                      href={`mailto:${user.email}?subject=Sky Journal Support`}
                      className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0 font-medium"
                    >Send Email ↗</a>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">No email on file</div>
                )}
              </div>

              {/* Content stats */}
              <div className="px-5 py-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Content</div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: "Stories",   val: user.storyCount },
                    { label: "Outfits",   val: user.outfitCount },
                    { label: "Journal",   val: user.journalCount },
                    { label: "Following", val: user.followingCount },
                    { label: "Followers", val: user.followersCount },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/40 rounded-xl py-2.5 px-1 border">
                      <div className="text-lg font-semibold tabular-nums">{s.val}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bio + mood */}
              {(user.bio || user.mood) && (
                <div className="px-5 py-4 space-y-3">
                  {user.bio && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Bio</div>
                      <p className="text-sm italic text-muted-foreground leading-relaxed">{user.bio}</p>
                    </div>
                  )}
                  {user.mood && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Mood</div>
                      <span className="text-sm">{user.mood}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Traits */}
              {user.traits && user.traits.length > 0 && (
                <div className="px-5 py-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Traits</div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.traits.map(t => (
                      <span key={t} className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Account info */}
              <div className="px-5 py-4 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Account</div>
                <Row label="User ID"      value={<span className="font-mono text-[11px] break-all">{user.userId}</span>} />
                {joinDate   && <Row label="Joined"       value={joinDate} />}
                {lastActive && <Row label="Last active"  value={lastActive} />}
                <Row label="Profile"      value={user.isPublic ? "Public" : "Private"} />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground">Gallery limit</span>
                  {limitMode ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" min={1} max={50000}
                        className="w-20 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={limitVal}
                        onChange={e => setLimitVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSaveLimit(); if (e.key === "Escape") setLimitMode(false); }}
                        autoFocus
                      />
                      <button onClick={handleSaveLimit} disabled={limitSaving}
                        className="px-2 py-1 text-xs rounded bg-primary text-white font-medium disabled:opacity-50"
                      >{limitSaving ? "…" : "Save"}</button>
                      <button onClick={() => setLimitMode(false)} className="px-2 py-1 text-xs rounded border hover:bg-muted">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setLimitMode(true)} className="flex items-center gap-1.5 text-sm group">
                      <span className="font-medium tabular-nums">{user.galleryLimit ?? 200}</span>
                      <span className="opacity-0 group-hover:opacity-60 transition-opacity text-xs">✏</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-5">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Actions</div>

                {confirm ? (
                  <div className="bg-muted/40 border rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium">
                      {confirm === "delete" ? `Permanently delete ${user.name}? This cannot be undone.`
                       : confirm === "ban"   ? `Ban ${user.name}? They'll be hidden from the discover feed.`
                       : confirm === "unban" ? `Unban ${user.name}? They'll regain full access.`
                       : user.isAdmin        ? `Remove admin access from ${user.name}?`
                                             : `Grant admin access to ${user.name}?`}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirm(null)} className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">Cancel</button>
                      <button
                        onClick={() => handleAction(confirm)}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 transition-colors ${confirm === "delete" ? "bg-red-600" : confirm === "ban" ? "bg-orange-600" : "bg-primary"}`}
                      >Confirm</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <ActionBtn
                      label={user.isBanned ? "Unban user" : "Ban user"}
                      color={user.isBanned ? "green" : "orange"}
                      onClick={() => setConfirm(user.isBanned ? "unban" : "ban")}
                    />
                    <ActionBtn
                      label={user.isAdmin ? "Demote admin" : "Promote to admin"}
                      color="purple"
                      onClick={() => setConfirm("admin")}
                    />
                    <a
                      href={user.email ? `mailto:${user.email}?subject=Sky Journal Support` : undefined}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-xl font-medium transition-colors border ${user.email ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" : "opacity-40 cursor-not-allowed bg-muted text-muted-foreground border-border"}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                      </svg>
                      Send email
                    </a>
                    <ActionBtn
                      label="Delete account"
                      color="red"
                      onClick={() => setConfirm("delete")}
                    />
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-[60]">
          {toast}
        </div>
      )}
    </>
  );
}

function Badge({ color, children }: { color: "purple" | "red" | "green" | "gray"; children: React.ReactNode }) {
  const cls = {
    purple: "bg-purple-100 text-purple-700",
    red:    "bg-red-100 text-red-700",
    green:  "bg-green-100 text-green-700",
    gray:   "bg-gray-100 text-gray-600",
  }[color];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: "orange" | "green" | "purple" | "red"; onClick: () => void }) {
  const cls = {
    orange: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    green:  "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
    purple: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    red:    "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
  }[color];
  return (
    <button onClick={onClick} className={`px-3 py-2.5 text-sm rounded-xl font-medium transition-colors border ${cls}`}>
      {label}
    </button>
  );
}
