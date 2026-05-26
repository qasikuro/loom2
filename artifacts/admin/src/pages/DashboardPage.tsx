import { useEffect, useState } from "react";
import { api, type Stats } from "../api";

const cards = (s: Stats) => [
  { label: "Total Users",      value: s.totalUsers,      color: "text-blue-600",  bg: "bg-blue-50" },
  { label: "New (30 days)",    value: s.recentSignups,   color: "text-green-600", bg: "bg-green-50" },
  { label: "Banned Users",     value: s.bannedUsers,     color: "text-red-600",   bg: "bg-red-50" },
  { label: "Admin Accounts",   value: s.adminUsers,      color: "text-purple-600",bg: "bg-purple-50" },
  { label: "Total Stories",    value: s.totalStories,    color: "text-indigo-600",bg: "bg-indigo-50" },
  { label: "Total Outfits",    value: s.totalOutfits,    color: "text-pink-600",  bg: "bg-pink-50" },
  { label: "Journal Entries",  value: s.totalJournals,   color: "text-teal-600",  bg: "bg-teal-50" },
  { label: "Vibe Stickers",    value: s.totalStickers,   color: "text-violet-600",bg: "bg-violet-50" },
  { label: "Pending Reports",  value: s.pendingReports,  color: s.pendingReports > 0 ? "text-orange-600" : "text-gray-600", bg: s.pendingReports > 0 ? "bg-orange-50" : "bg-gray-50" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-600">Failed to load stats: {error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of Sky Journal activity</p>
      </div>

      {!stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-20 mb-3" />
              <div className="h-8 bg-muted rounded w-12" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards(stats).map((c) => (
            <div key={c.label} className="bg-card rounded-xl border p-5 hover:shadow-sm transition-shadow">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className={`text-3xl font-bold mt-2 ${c.color}`}>{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border p-5">
        <h2 className="font-semibold text-foreground mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <a href="#/users" className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">Manage Users</a>
          <a href="#/reports" className="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity">
            Review Reports {stats && stats.pendingReports > 0 && `(${stats.pendingReports})`}
          </a>
          <a href="#/content" className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity">Moderate Content</a>
        </div>
      </div>
    </div>
  );
}
