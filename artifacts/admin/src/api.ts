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
  getConfig:      () => apiFetch<{ publishableKey: string }>("/admin/config"),
  getUserDetail:  (id: string) => apiFetch<AdminUserDetail>(`/admin/users/${id}`),
  getMe:         () => apiFetch<{ userId: string; name: string; isAdmin: boolean }>("/admin/me"),
  getStats:      () => apiFetch<Stats>("/admin/stats"),
  getUsers:      (q = "", offset = 0) => apiFetch<{ users: AdminUser[]; total: number }>(`/admin/users?q=${encodeURIComponent(q)}&offset=${offset}&limit=50`),
  banUser:       (id: string) => apiFetch(`/admin/users/${id}/ban`, { method: "PUT" }),
  unbanUser:     (id: string) => apiFetch(`/admin/users/${id}/unban`, { method: "PUT" }),
  deleteUser:    (id: string) => apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
  toggleAdmin:     (id: string) => apiFetch<{ isAdmin: boolean }>(`/admin/users/${id}/toggle-admin`, { method: "PUT" }),
  setGalleryLimit: (id: string, limit: number) => apiFetch<{ ok: boolean; limit: number }>(`/admin/users/${id}/gallery-limit`, { method: "PUT", body: JSON.stringify({ limit }) }),
  getContent:    (type: "stories" | "outfits", offset = 0, q = "", dateFrom = "", dateTo = "") => apiFetch<{ items: ContentItem[]; total: number }>(`/admin/content?type=${type}&offset=${offset}&limit=50&q=${encodeURIComponent(q)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`),
  hideContent:   (type: "stories" | "outfits", id: string) => apiFetch(`/admin/content/${type}/${id}/hide`, { method: "PUT" }),
  unhideContent: (type: "stories" | "outfits", id: string) => apiFetch(`/admin/content/${type}/${id}/unhide`, { method: "PUT" }),
  deleteContent: (type: "stories" | "outfits", id: string) => apiFetch(`/admin/content/${type}/${id}`, { method: "DELETE" }),
  setupAdmin:    () => apiFetch<{ ok: boolean; message: string }>("/admin/setup", { method: "POST" }),
  getReports:    (status: string, offset = 0) => apiFetch<{ reports: Report[]; total: number }>(`/admin/reports?status=${status}&offset=${offset}&limit=50`),
  resolveReport: (id: string, status: "resolved" | "dismissed") => apiFetch(`/admin/reports/${id}/resolve`, { method: "PUT", body: JSON.stringify({ status }) }),
  deleteReport:  (id: string) => apiFetch(`/admin/reports/${id}`, { method: "DELETE" }),
  getStickers:   (offset = 0) => apiFetch<{ stickers: AdminSticker[]; total: number }>(`/admin/stickers?offset=${offset}`),

  // Profile Effects
  getProfileEffects:     () => apiFetch<{ effects: ProfileEffectRow[] }>("/admin/profile-effects"),
  createProfileEffect:   (body: EffectBody) => apiFetch<{ effect: ProfileEffectRow }>("/admin/profile-effects", { method: "POST", body: JSON.stringify(body) }),
  updateProfileEffect:   (id: string, body: Partial<EffectBody>) => apiFetch<{ effect: ProfileEffectRow }>(`/admin/profile-effects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProfileEffect:   (id: string) => apiFetch(`/admin/profile-effects/${id}`, { method: "DELETE" }),
  generateEffectConfig:  (body: GenerateEffectConfigBody) => apiFetch<{ config: EffectConfig }>("/admin/profile-effects/generate-config", { method: "POST", body: JSON.stringify(body) }),

  // Events
  getEvents:         () => apiFetch<{ events: AdminEvent[] }>("/admin/events"),
  createEvent:       (body: EventBody) => apiFetch<AdminEvent>("/admin/events", { method: "POST", body: JSON.stringify(body) }),
  updateEvent:       (id: string, body: EventBody) => apiFetch<AdminEvent>(`/admin/events/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteEvent:       (id: string) => apiFetch(`/admin/events/${id}`, { method: "DELETE" }),
  generateInventory: (body: GenerateInventoryBody) => apiFetch<{ inventory: EventInventoryItem[]; prompt: string }>("/admin/events/generate-inventory", { method: "POST", body: JSON.stringify(body) }),
  grantEvent:        (id: string) => apiFetch<{ granted: number; stars: number; aura: number; shards: number; itemsGranted: number; message: string }>(`/admin/events/${id}/grant`, { method: "POST" }),
};

export interface Stats {
  totalUsers: number;
  bannedUsers: number;
  adminUsers: number;
  totalStories: number;
  totalOutfits: number;
  pendingReports: number;
  recentSignups: number;
  totalJournals: number;
  totalStickers: number;
}

export interface AdminSticker {
  id:           string;
  fromUserId:   string;
  fromName:     string;
  fromUsername: string | null;
  toUserId:     string;
  toName:       string;
  toUsername:   string | null;
  storyId:      string;
  stickerType:  string;
  createdAt:    string;
}

export interface AdminUser {
  userId:       string;
  username:     string | null;
  name:         string;
  bio:          string;
  mood:         string;
  isPublic:     boolean;
  isAdmin:      boolean;
  isBanned:     boolean;
  galleryLimit: number;
  updatedAt:    string;
  email?:       string | null;
  lastSignInAt?: number | null;
}

export interface AdminUserDetail extends AdminUser {
  email:          string | null;
  clerkCreatedAt: number | null;
  traits:         string[] | null;
  storyCount:     number;
  outfitCount:    number;
  journalCount:   number;
  followingCount: number;
  followersCount: number;
}

export interface StoryPanel {
  id?: string;
  imageUri?: string;
  text?: string;
  bubbleText?: string;
}

export interface ContentItem {
  id: string;
  userId: string;
  chapterTitle?: string;
  name?: string;
  description?: string;
  imageUri?: string;
  tags?: string[];
  mood?: string;
  isPublic: boolean;
  isHidden: boolean;
  witnessedCount?: number;
  savedCount?: number;
  panels?: StoryPanel[];
  date: string;
  authorName: string | null;
  username: string | null;
}

export interface EventInventoryItem {
  type:      "stars" | "aura" | "shards" | "item";
  amount?:   number;
  itemId?:   string;
  itemName?: string;
  label:     string;
}

export interface AdminEvent {
  id:          string;
  title:       string;
  description: string;
  theme:       string;
  status:      string;
  startsAt:    string | null;
  endsAt:      string | null;
  inventory:   EventInventoryItem[];
  aiPrompt:    string;
  createdBy:   string;
  createdAt:   string;
}

export interface EventBody {
  title:       string;
  description: string;
  theme:       string;
  status:      string;
  startsAt:    string | null;
  endsAt:      string | null;
  inventory:   EventInventoryItem[];
  aiPrompt:    string;
}

export interface GenerateInventoryBody {
  title:       string;
  description: string;
  theme:       string;
  extra:       string;
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

// ── Profile Effects ───────────────────────────────────────────────────────────

export interface EffectConfig {
  particles:   string[];
  count:       number;
  mode:        "rise" | "fall" | "drift" | "glow";
  fontSize:    number;
  colors?:     string[];
  speedMs:     [number, number];
  xSwingPct:   number;
  yTravelPct:  number;
  corners?:    { pos: "tl" | "tr" | "bl" | "br"; emoji: string; size: number }[];
  overlayTint?: string;
}

export interface ProfileEffectRow {
  id:            string;
  name:          string;
  description:   string;
  icon:          string;
  theme:         string;
  rarity:        string;
  config:        EffectConfig;
  isActive:      boolean;
  shopCost:      { stars?: number; aura?: number; shards?: number };
  previewColors: string[];
  createdBy:     string;
  createdAt:     string;
}

export interface EffectBody {
  name:          string;
  description:   string;
  icon:          string;
  theme:         string;
  rarity:        string;
  config:        EffectConfig;
  isActive:      boolean;
  shopCost:      { stars?: number; aura?: number; shards?: number };
  previewColors: string[];
}

export interface GenerateEffectConfigBody {
  name:        string;
  description: string;
  theme:       string;
  extra:       string;
}
