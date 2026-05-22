export const API_BASE = "/api";

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getConfig:     () => apiFetch<{ publishableKey: string }>("/admin/config"),
  getMe:         () => apiFetch<{ userId: string; name: string; isAdmin: boolean }>("/admin/me"),
  getStats:      () => apiFetch<Stats>("/admin/stats"),
  getUsers:      (q = "", offset = 0) => apiFetch<{ users: AdminUser[]; total: number }>(`/admin/users?q=${encodeURIComponent(q)}&offset=${offset}&limit=50`),
  banUser:       (id: string) => apiFetch(`/admin/users/${id}/ban`, { method: "PUT" }),
  unbanUser:     (id: string) => apiFetch(`/admin/users/${id}/unban`, { method: "PUT" }),
  deleteUser:    (id: string) => apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
  toggleAdmin:   (id: string) => apiFetch<{ isAdmin: boolean }>(`/admin/users/${id}/toggle-admin`, { method: "PUT" }),
  getContent:    (type: "stories" | "outfits", offset = 0) => apiFetch<{ items: ContentItem[]; total: number }>(`/admin/content?type=${type}&offset=${offset}&limit=50`),
  hideContent:   (type: "stories" | "outfits", id: string) => apiFetch(`/admin/content/${type}/${id}/hide`, { method: "PUT" }),
  unhideContent: (type: "stories" | "outfits", id: string) => apiFetch(`/admin/content/${type}/${id}/unhide`, { method: "PUT" }),
  deleteContent: (type: "stories" | "outfits", id: string) => apiFetch(`/admin/content/${type}/${id}`, { method: "DELETE" }),
  getReports:    (status: string, offset = 0) => apiFetch<{ reports: Report[]; total: number }>(`/admin/reports?status=${status}&offset=${offset}&limit=50`),
  resolveReport: (id: string, status: "resolved" | "dismissed") => apiFetch(`/admin/reports/${id}/resolve`, { method: "PUT", body: JSON.stringify({ status }) }),
  deleteReport:  (id: string) => apiFetch(`/admin/reports/${id}`, { method: "DELETE" }),
};

export interface Stats {
  totalUsers: number;
  bannedUsers: number;
  adminUsers: number;
  totalStories: number;
  totalOutfits: number;
  pendingReports: number;
  recentSignups: number;
}

export interface AdminUser {
  userId: string;
  username: string | null;
  name: string;
  bio: string;
  mood: string;
  isPublic: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  updatedAt: string;
}

export interface ContentItem {
  id: string;
  userId: string;
  chapterTitle?: string;
  name?: string;
  mood?: string;
  isPublic: boolean;
  isHidden: boolean;
  witnessedCount?: number;
  savedCount?: number;
  date: string;
  authorName: string | null;
  username: string | null;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  status: string;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
