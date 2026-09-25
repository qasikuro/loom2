import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  Database,
  FileText,
  Gauge,
  ImagePlus,
  LifeBuoy,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { api, type Stats } from "../api";

type Metric = {
  label: string;
  value: number;
  icon: typeof UsersRound;
  tone: string;
  note: string;
};

const metricCards = (s: Stats): Metric[] => [
  { label: "Total users", value: s.totalUsers, icon: UsersRound, tone: "blue", note: "registered accounts" },
  { label: "Online now", value: s.onlineUsers, icon: Activity, tone: "green", note: "current presence" },
  { label: "New signups", value: s.recentSignups, icon: UsersRound, tone: "violet", note: "last 30 days" },
  { label: "Content created", value: s.totalStories + s.totalOutfits, icon: FileText, tone: "pink", note: "stories + outfits" },
  { label: "Pending reports", value: s.pendingReports, icon: AlertCircle, tone: "orange", note: "needs review" },
];

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function Dot({ tone = "green" }: { tone?: "green" | "blue" | "orange" | "red" }) {
  const toneClass = { green: "bg-emerald-400", blue: "bg-blue-400", orange: "bg-orange-400", red: "bg-red-400" }[tone];
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${toneClass}`} />;
}

function PanelHeading({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Activity;
  title: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
        <Icon size={14} className="text-primary" strokeWidth={2} />
        {title}
      </div>
      {action && <span className="text-[10px] font-medium text-primary/80">{action}</span>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const value = await api.getStats();
      setStats(value);
      setLastUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, []);

  useEffect(() => {
    void refreshStats();
    const interval = window.setInterval(() => void refreshStats(), 30_000);
    return () => window.clearInterval(interval);
  }, [refreshStats]);

  const retry = () => {
    setError("");
    void refreshStats();
  };

  return (
    <div className="admin-enter admin-grid min-h-[calc(100dvh-61px)] p-4 sm:p-6 lg:p-7">
      <div className="mx-auto max-w-[1560px]">
        <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-emerald-300">
                <Dot /> Live operations
              </span>
              {lastUpdated && <span className="font-mono text-[10px] text-muted-foreground">synced {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
            <h1 className="text-[25px] font-extrabold tracking-[-0.04em] text-foreground sm:text-[30px]">{greeting}, Operator.</h1>
            <p className="mt-1 text-xs text-muted-foreground">Here’s what’s happening across the Gamejo community right now.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-md border border-border bg-card/70 px-3 py-2 xl:self-auto">
            <Clock3 size={14} className="text-primary" />
            <span className="font-mono text-[10px] text-muted-foreground">{new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
            <span className="text-[10px] text-border">/</span>
            <span className="font-mono text-[10px] text-foreground">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        {error && !stats ? (
          <div className="admin-panel flex items-center justify-between gap-4 rounded-md p-4 text-sm text-red-200">
            <div className="flex items-center gap-3"><AlertCircle size={18} className="text-red-400" /><span>Could not load live statistics. {error}</span></div>
            <button onClick={retry} className="inline-flex items-center gap-2 rounded border border-red-400/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10"><RefreshCw size={13} /> Retry</button>
          </div>
        ) : !stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => <div key={index} className="admin-panel h-[112px] animate-pulse rounded-md p-4"><div className="h-3 w-20 rounded bg-muted" /><div className="mt-5 h-7 w-24 rounded bg-muted" /></div>)}
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="admin-panel mb-3 flex items-center justify-between gap-4 rounded-md p-3 text-xs text-amber-200">
                <div className="flex items-center gap-3"><AlertCircle size={15} className="text-amber-300" /><span>Could not refresh live statistics. Showing the last successful update. {error}</span></div>
                <button onClick={retry} className="inline-flex shrink-0 items-center gap-2 rounded border border-amber-300/30 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-300/10"><RefreshCw size={12} /> Retry</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {metricCards(stats).map((metric) => {
                const Icon = metric.icon;
                const toneClass = {
                  blue: "bg-blue-400/10 text-blue-300",
                  green: "bg-emerald-400/10 text-emerald-300",
                  violet: "bg-violet-400/10 text-violet-300",
                  pink: "bg-pink-400/10 text-pink-300",
                  orange: "bg-orange-400/10 text-orange-300",
                }[metric.tone];
                return (
                  <div key={metric.label} className="admin-panel group rounded-md p-4 transition-colors hover:border-primary/40">
                    <div className="flex items-start justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{metric.label}</p>
                      <span className={`flex h-7 w-7 items-center justify-center rounded-md ${toneClass}`}><Icon size={15} /></span>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-2">
                      <p className="font-mono text-[25px] font-medium leading-none tracking-[-0.05em] text-foreground">{formatNumber(metric.value)}</p>
                      {metric.label === "Online now" && <Dot />}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">{metric.note}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(270px,.7fr)]">
              <section className="admin-panel overflow-hidden rounded-md">
                <PanelHeading icon={BarChart3} title="Community telemetry" action="no time-series connection" />
                <div className="admin-grid relative h-[245px] overflow-hidden px-4 pb-6 pt-4 sm:h-[270px]">
                  <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-border/70" />
                  <div className="absolute inset-x-4 top-1/4 border-t border-dashed border-border/50" />
                  <div className="absolute inset-x-4 top-3/4 border-t border-dashed border-border/50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="max-w-xs text-center">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary"><Gauge size={18} /></div>
                      <p className="text-xs font-semibold text-foreground">Historical telemetry is not connected</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">The live summary above is available from the admin stats endpoint. Time-series activity will appear when analytics data is wired.</p>
                    </div>
                  </div>
                  <div className="absolute inset-x-4 bottom-2 flex justify-between font-mono text-[9px] text-muted-foreground/60"><span>24h ago</span><span>12h ago</span><span>now</span></div>
                </div>
                <div className="grid grid-cols-3 border-t border-border/70">
                  {([
                    ["Stories", stats.totalStories, BookOpen],
                    ["Outfits", stats.totalOutfits, Sparkles],
                    ["Journals", stats.totalJournals, FileText],
                  ] as [string, number, typeof BookOpen][]).map(([label, value, StatIcon]) => {
                    return <div key={String(label)} className="border-r border-border/70 px-4 py-3 last:border-0"><div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><StatIcon size={12} />{label}</div><p className="mt-1 font-mono text-sm text-foreground">{formatNumber(value as number)}</p></div>;
                  })}
                </div>
              </section>

              <section className="admin-panel overflow-hidden rounded-md">
                <PanelHeading icon={Server} title="System status" action="view details" />
                <div className="space-y-1 p-3">
                  <StatusRow label="Admin API" state="Connected" healthy />
                  <StatusRow label="Database telemetry" state="Not connected" />
                  <StatusRow label="Media processing" state="Not connected" />
                  <StatusRow label="AI moderation" state="Not connected" />
                  <StatusRow label="Notifications" state="Not connected" />
                </div>
                <div className="mx-3 mb-3 flex items-center gap-2 rounded border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-[10px] text-emerald-200"><CheckCircle2 size={13} /> Stats endpoint responding normally</div>
              </section>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <section className="admin-panel overflow-hidden rounded-md">
                <PanelHeading icon={Send} title="Quick actions" />
                <div className="grid grid-cols-2 gap-2 p-3">
                  <ActionLink href="#/users" icon={UsersRound} label="Manage users" />
                  <ActionLink href="#/content" icon={ShieldCheck} label="Moderate content" />
                  <ActionLink href="#/reports" icon={AlertCircle} label="Review reports" badge={stats.pendingReports} />
                  <ActionLink href="#/events" icon={Sparkles} label="Community events" />
                  <ActionLink href="#/notifications" icon={Bell} label="Send notification" />
                  <ActionLink href="#/settings" icon={Gauge} label="Admin settings" />
                </div>
              </section>
              <section className="admin-panel overflow-hidden rounded-md">
                <PanelHeading icon={Activity} title="Live activity" action="not connected" />
                <UnavailableState icon={CircleDashed} text="Activity stream is not connected" detail="No simulated events are shown." />
              </section>
              <section className="admin-panel overflow-hidden rounded-md">
                <PanelHeading icon={UploadCloud} title="Content pipeline" action="not connected" />
                <UnavailableState icon={ImagePlus} text="Upload queue is not connected" detail="Processing status will appear here when available." />
              </section>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
              <section className="admin-panel overflow-hidden rounded-md">
                <PanelHeading icon={LifeBuoy} title="Needs your attention" action="operator queue" />
                <div className="p-3">
                  {stats.pendingReports > 0 ? (
                    <a href="#/reports" className="flex items-center justify-between rounded border border-orange-400/20 bg-orange-400/5 px-3 py-3 transition-colors hover:bg-orange-400/10">
                      <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-400/15 text-orange-300"><AlertCircle size={16} /></span><div><p className="text-xs font-semibold text-foreground">Reports awaiting review</p><p className="mt-1 text-[10px] text-muted-foreground">{formatNumber(stats.pendingReports)} pending report{stats.pendingReports === 1 ? "" : "s"} from the moderation queue</p></div></div>
                      <ArrowUpRight size={15} className="text-orange-300" />
                    </a>
                  ) : <UnavailableState icon={CheckCircle2} text="No pending reports" detail="The moderation queue is clear." healthy />}
                </div>
              </section>
              <section className="admin-panel overflow-hidden rounded-md">
                <PanelHeading icon={Database} title="Data inventory" />
                <div className="grid grid-cols-2 gap-px bg-border/60">
                  <Inventory label="Stickers" value={stats.totalStickers} />
                  <Inventory label="Admins" value={stats.adminUsers} />
                  <Inventory label="Banned users" value={stats.bannedUsers} />
                  <Inventory label="Online now" value={stats.onlineUsers} />
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, state, healthy = false }: { label: string; state: string; healthy?: boolean }) {
  return <div className="flex items-center justify-between rounded px-2 py-2 text-[11px] hover:bg-muted/50"><span className="flex items-center gap-2 text-muted-foreground"><Dot tone={healthy ? "green" : "blue"} />{label}</span><span className={healthy ? "text-emerald-300" : "font-mono text-[10px] text-muted-foreground"}>{state}</span></div>;
}

function ActionLink({ href, icon: Icon, label, badge }: { href: string; icon: typeof Activity; label: string; badge?: number }) {
  return <a href={href} className="flex min-h-9 items-center justify-between gap-2 rounded border border-border/80 bg-muted/40 px-2.5 text-[10px] font-medium text-secondary-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"><span className="flex items-center gap-2"><Icon size={13} className="text-primary" />{label}</span>{badge !== undefined && badge > 0 && <span className="rounded-full bg-orange-400/15 px-1.5 py-0.5 font-mono text-[9px] text-orange-300">{badge}</span>}</a>;
}

function UnavailableState({ icon: Icon, text, detail, healthy = false }: { icon: typeof CircleDashed; text: string; detail: string; healthy?: boolean }) {
  return <div className="flex min-h-[122px] flex-col items-center justify-center px-5 text-center"><Icon size={20} className={healthy ? "text-emerald-300" : "text-muted-foreground"} /><p className="mt-2 text-xs font-semibold text-foreground">{text}</p><p className="mt-1 text-[10px] text-muted-foreground">{detail}</p></div>;
}

function Inventory({ label, value }: { label: string; value: number }) {
  return <div className="bg-card px-3 py-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm text-foreground">{formatNumber(value)}</p></div>;
}
