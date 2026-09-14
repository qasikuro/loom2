import { useEffect, useState, type ReactNode } from "react";
import { ClerkProvider, SignIn, useAuth, useUser } from "@clerk/clerk-react";
import {
  Activity,
  BarChart3,
  Ban,
  Bell,
  BookOpen,
  Bot,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Command,
  Database,
  EyeOff,
  FileWarning,
  Flag,
  Gamepad2,
  History,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessagesSquare,
  Monitor,
  Palette,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  Settings2,
  Shield,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Sticker,
  Tags,
  Target,
  TrendingUp,
  UserCog,
  UserPlus,
  UsersRound,
  Video,
  Wrench,
  X,
} from "lucide-react";
import { api, setTokenGetter } from "./api";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import ContentPage from "./pages/ContentPage";
import ReportsPage from "./pages/ReportsPage";
import EventsPage from "./pages/EventsPage";
import EffectsPage from "./pages/EffectsPage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import BadgesPage from "./pages/BadgesPage";
import PlaceholderPage from "./pages/PlaceholderPage";

type Icon = typeof LayoutDashboard;
type NavItem = { id: string; label: string; icon: Icon; page?: string };
type NavGroup = { id: string; label: string; icon: Icon; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "users", label: "Users", icon: UsersRound, items: [
      { id: "all-users", label: "All Users", icon: UsersRound, page: "users" },
      { id: "new-users", label: "New Users", icon: UserPlus },
      { id: "beta-users", label: "Beta Users", icon: Sparkles },
      { id: "founders", label: "Founders", icon: Target },
      { id: "banned-suspended", label: "Banned / Suspended", icon: Ban },
      { id: "user-search", label: "User Search", icon: Search },
    ],
  },
  {
    id: "moderation", label: "Moderation", icon: ShieldCheck, items: [
      { id: "moderation-queue", label: "Moderation Queue", icon: ClipboardList },
      { id: "reports", label: "Reports", icon: Flag, page: "reports" },
      { id: "ai-moderation", label: "AI Moderation", icon: Bot },
      { id: "hidden-content", label: "Hidden Content", icon: EyeOff },
      { id: "banned-content", label: "Banned Content", icon: Ban },
      { id: "moderation-history", label: "Moderation History", icon: History },
    ],
  },
  {
    id: "content", label: "Content", icon: BookOpen, items: [
      { id: "stories", label: "Stories", icon: BookOpen, page: "content-stories" },
      { id: "outfits", label: "Outfits", icon: Shirt, page: "content-outfits" },
      { id: "videos", label: "Videos", icon: Video },
      { id: "images", label: "Images", icon: ImageIcon },
      { id: "stickers", label: "Stickers", icon: Sticker, page: "content-stickers" },
      { id: "comments", label: "Comments", icon: MessagesSquare },
      { id: "chats-messages", label: "Chats / Messages", icon: MessagesSquare },
    ],
  },
  {
    id: "games", label: "Games", icon: Gamepad2, items: [
      { id: "game-catalog", label: "Game Catalog", icon: Gamepad2 },
      { id: "game-search", label: "Game Search", icon: Search },
      { id: "game-metadata", label: "Game Metadata", icon: Database },
      { id: "game-images", label: "Game Images", icon: ImageIcon },
      { id: "genres", label: "Genres", icon: Tags },
      { id: "platforms", label: "Platforms", icon: Monitor },
      { id: "api-sync", label: "API Sync", icon: RefreshCw },
    ],
  },
  {
    id: "analytics", label: "Analytics", icon: BarChart3, items: [
      { id: "analytics-overview", label: "Overview", icon: BarChart3 },
      { id: "user-growth", label: "User Growth", icon: TrendingUp },
      { id: "activation", label: "Activation", icon: Target },
      { id: "retention", label: "Retention", icon: RefreshCw },
      { id: "engagement", label: "Engagement", icon: Activity },
      { id: "content-analytics", label: "Content", icon: BookOpen },
      { id: "feature-usage", label: "Feature Usage", icon: ChartNoAxesColumnIncreasing },
    ],
  },
  {
    id: "community", label: "Community", icon: MessagesSquare, items: [
      { id: "events", label: "Events", icon: Sparkles, page: "events" },
      { id: "featured-content", label: "Featured Content", icon: Palette },
      { id: "trending", label: "Trending", icon: TrendingUp },
      { id: "announcements", label: "Announcements", icon: Megaphone },
      { id: "community-health", label: "Community Health", icon: LifeBuoy },
    ],
  },
  {
    id: "rewards", label: "Rewards", icon: Target, items: [
      { id: "badges", label: "Badges", icon: CheckCircle2, page: "badges" },
      { id: "effects", label: "Effects", icon: Sparkles, page: "effects" },
      { id: "founder-program", label: "Founder Program", icon: Target },
      { id: "xp-stars", label: "XP / Stars", icon: Activity },
      { id: "achievements", label: "Achievements", icon: CheckCircle2 },
    ],
  },
  {
    id: "communication", label: "Communication", icon: Send, items: [
      { id: "push-notifications", label: "Push Notifications", icon: Bell, page: "notifications" },
      { id: "email", label: "Email", icon: Mail },
      { id: "in-app-announcements", label: "In-App Announcements", icon: Megaphone },
      { id: "campaigns", label: "Campaigns", icon: Send },
    ],
  },
  {
    id: "support", label: "Support", icon: LifeBuoy, items: [
      { id: "user-tickets", label: "User Tickets", icon: LifeBuoy },
      { id: "feedback", label: "Feedback", icon: MessagesSquare },
      { id: "bug-reports", label: "Bug Reports", icon: FileWarning },
      { id: "contact-requests", label: "Contact Requests", icon: Mail },
    ],
  },
  {
    id: "operations", label: "Operations", icon: Wrench, items: [
      { id: "feature-flags", label: "Feature Flags", icon: SlidersHorizontal },
      { id: "app-configuration", label: "App Configuration", icon: Settings2 },
      { id: "maintenance-mode", label: "Maintenance Mode", icon: Wrench },
      { id: "api-status", label: "API Status", icon: Server },
      { id: "ai-status", label: "AI Status", icon: Bot },
      { id: "system-health", label: "System Health", icon: Activity },
    ],
  },
  {
    id: "security", label: "Security", icon: Shield, items: [
      { id: "admin-users", label: "Admin Users", icon: UserCog },
      { id: "roles-permissions", label: "Roles & Permissions", icon: KeyRound },
      { id: "admin-activity", label: "Admin Activity", icon: Activity },
      { id: "audit-logs", label: "Audit Logs", icon: ClipboardList },
      { id: "login-security-events", label: "Login / Security Events", icon: LockKeyhole },
    ],
  },
  {
    id: "settings", label: "Settings", icon: Settings, items: [
      { id: "settings-general", label: "General", icon: Settings, page: "settings" },
      { id: "moderation-rules", label: "Moderation Rules", icon: ShieldCheck },
      { id: "notification-settings", label: "Notification Settings", icon: Bell },
      { id: "legal", label: "Legal", icon: LockKeyhole },
      { id: "data-privacy", label: "Data / Privacy", icon: Shield },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
const PLACEHOLDER_COPY: Record<string, string> = {
  "new-users": "A filtered view for recently created accounts will live here once the user segmentation endpoint is connected.",
  "moderation-queue": "This workspace will combine reports and automated signals into a single triage queue.",
  "game-catalog": "Game records, publishing state, and operator actions will appear here when the games service is connected.",
  "analytics-overview": "Cross-product reporting will be available here when the analytics pipeline is connected.",
  "feature-flags": "Operator-managed feature rollout controls will appear here when the configuration service is connected.",
  "api-status": "Service checks and incident context will appear here when health endpoints are connected.",
};

function routeFromHash() {
  const route = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return route || "dashboard";
}

function AccessDenied({ email, onRetry }: { email?: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-5">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-xl shadow-primary/5">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Shield size={23} /></div>
        <h2 className="text-xl font-bold tracking-tight">Admin access required</h2>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{email}</span></p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">This account does not have admin access. Contact an administrator to be granted access.</p>
        <button data-testid="button-retry-admin-access" onClick={onRetry} className="mt-6 text-xs font-medium text-primary hover:underline">Retry access check</button>
      </div>
    </div>
  );
}

function Sidebar({
  route, collapsed, mobileOpen, setCollapsed, setMobileOpen, onNavigate,
}: {
  route: string; collapsed: boolean; mobileOpen: boolean; setCollapsed: (value: boolean) => void;
  setMobileOpen: (value: boolean) => void; onNavigate: (route: string) => void;
}) {
  const { signOut } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, true])),
  );
  const activeItem = ALL_ITEMS.find((item) => (item.page ?? item.id) === route || item.id === route);

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-navigation-overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl shadow-slate-950/30 transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[72px]" : ""}`}>
        <div className={`flex h-[64px] shrink-0 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-3" : "justify-between px-4"}`}>
          <button data-testid="button-gamejo-home" onClick={() => onNavigate("dashboard")} className="flex items-center gap-3 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/10"><Command size={17} strokeWidth={2.2} /></span>
            {!collapsed && <span><span className="block text-[14px] font-extrabold tracking-[-0.04em] text-white">GAMEJO</span><span className="block font-mono text-[8px] uppercase tracking-[0.16em] text-sidebar-foreground/50">Admin console</span></span>}
          </button>
          <button data-testid="button-collapse-sidebar" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)} className="hidden rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-white lg:block">
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <nav className="admin-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          <button data-testid="nav-dashboard" onClick={() => onNavigate("dashboard")} title={collapsed ? "Dashboard" : undefined} className={`mb-3 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[12px] font-semibold transition-colors ${route === "dashboard" ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/10" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white"} ${collapsed ? "justify-center" : ""}`}>
            <LayoutDashboard size={17} />
            {!collapsed && "Dashboard"}
          </button>
           {!collapsed && <p className="mb-2 px-3 font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/35">Workspaces</p>}
           <div className="space-y-0.5">
            {NAV_GROUPS.map((group) => {
              const groupActive = activeItem?.group === group.label;
              const isOpen = openGroups[group.id];
              return (
                <div key={group.id}>
                   <button data-testid={`nav-group-${group.id}`} onClick={() => collapsed ? onNavigate(group.items[0].page ?? group.items[0].id) : setOpenGroups((current) => ({ ...current, [group.id]: !current[group.id] }))} title={collapsed ? group.label : undefined} className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-[11px] font-semibold transition-colors ${groupActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"} ${collapsed ? "justify-center" : ""}`}>
                    <group.icon size={16} strokeWidth={1.8} />
                    {!collapsed && <><span className="flex-1">{group.label}</span>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</>}
                  </button>
                  {!collapsed && isOpen && <div className="ml-3 border-l border-sidebar-border pl-3">
                    {group.items.map((item) => {
                      const itemRoute = item.page ?? item.id;
                      const active = route === itemRoute || (item.page === "content" && route === "content");
                      return (
                         <button key={item.id} data-testid={`nav-${item.id}`} onClick={() => onNavigate(itemRoute)} className={`my-0.5 flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-left text-[11px] transition-colors ${active ? "bg-sidebar-accent font-semibold text-white" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"}`}>
                          <item.icon size={14} strokeWidth={1.8} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>}
                </div>
              );
            })}
          </div>
        </nav>

        <div className={`border-t border-sidebar-border p-2.5 ${collapsed ? "flex justify-center" : ""}`}>
          <button data-testid="button-sign-out" onClick={() => signOut()} title={collapsed ? "Sign out" : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-white ${collapsed ? "justify-center" : ""}`}>
            <LogOut size={16} />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>
    </>
  );
}

function Layout({ children, route, onNavigate }: { children: ReactNode; route: string; onNavigate: (route: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const active = ALL_ITEMS.find((item) => (item.page ?? item.id) === route || item.id === route);
  return (
    <div className="admin-noise flex min-h-[100dvh] bg-background">
      <Sidebar route={route} collapsed={collapsed} mobileOpen={mobileOpen} setCollapsed={setCollapsed} setMobileOpen={setMobileOpen} onNavigate={(next) => { setMobileOpen(false); onNavigate(next); }} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex min-h-[64px] items-center justify-between gap-3 border-b border-border bg-background/95 px-3 backdrop-blur-md sm:px-5 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button data-testid="button-open-navigation" aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="rounded-md border border-border bg-card p-2 text-muted-foreground hover:text-foreground lg:hidden"><Menu size={17} /></button>
            <div className="hidden min-w-[190px] md:block">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Gamejo / {active?.group ?? "Dashboard"}</p>
              <h1 className="mt-0.5 truncate text-xs font-bold tracking-tight text-foreground">{active?.label ?? (route === "dashboard" ? "Dashboard" : "Workspace")}</h1>
            </div>
            <div className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-border bg-card/80 px-3 text-[11px] text-muted-foreground sm:w-[280px] lg:w-[350px]">
              <Search size={14} className="shrink-0 text-muted-foreground/70" />
              <span className="truncate">Search users, content, games...</span>
              <span className="ml-auto hidden rounded border border-border px-1 font-mono text-[9px] text-muted-foreground/70 sm:inline">⌘ K</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[10px] text-emerald-300 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Admin API connected</div>
            <button aria-label="Notifications" className="relative rounded-md p-2 text-muted-foreground hover:bg-card hover:text-foreground"><Bell size={16} /><span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" /></button>
            <div className="flex items-center gap-2 border-l border-border pl-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{(user?.firstName?.[0] ?? "O")}{(user?.lastName?.[0] ?? "")}</div>
              <div className="hidden leading-tight lg:block"><p className="text-[11px] font-semibold text-foreground">{user?.fullName ?? "Operator"}</p><p className="font-mono text-[9px] text-muted-foreground">Admin</p></div>
              <ChevronDown size={13} className="hidden text-muted-foreground lg:block" />
            </div>
          </div>
        </header>
        <div key={route}>{children}</div>
      </main>
    </div>
  );
}

function renderPage(route: string): ReactNode {
  if (route === "dashboard") return <DashboardPage />;
  if (route === "users") return <UsersPage />;
  if (route === "content" || route === "content-stories") return <ContentPage initialType="stories" />;
  if (route === "content-outfits") return <ContentPage initialType="outfits" />;
  if (route === "content-stickers") return <ContentPage initialType="stories" initialShowStickers />;
  if (route === "reports") return <ReportsPage />;
  if (route === "events") return <EventsPage />;
  if (route === "badges") return <BadgesPage />;
  if (route === "effects") return <EffectsPage />;
  if (route === "notifications") return <NotificationsPage />;
  if (route === "settings") return <SettingsPage />;
  const item = ALL_ITEMS.find((entry) => entry.id === route);
  return <PlaceholderPage section={item?.group ?? "Workspace"} label={item?.label ?? "Workspace"} description={PLACEHOLDER_COPY[route]} />;
}

function AdminApp() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [route, setRoute] = useState(routeFromHash);
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    const syncRoute = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => { window.removeEventListener("hashchange", syncRoute); window.removeEventListener("popstate", syncRoute); };
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    setAdminChecked(false);
    api.getMe().then((me) => { setIsAdmin(me.isAdmin); setAdminChecked(true); }).catch(() => { setIsAdmin(false); setAdminChecked(true); });
  }, [isLoaded, isSignedIn]);

  const navigate = (next: string) => {
    if (route === next) return;
    window.location.hash = `/${next}`;
  };

  if (!isLoaded) return <LoadingScreen label="Loading Gamejo" />;
  if (!isSignedIn) return <div className="flex min-h-[100dvh] items-center justify-center bg-background p-5"><div className="w-full max-w-md space-y-6"><div className="text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Command size={23} /></div><h1 className="text-2xl font-extrabold tracking-tight">Gamejo Admin</h1><p className="mt-1 text-sm text-muted-foreground">Sign in to access the operator command center</p></div><SignIn routing="hash" /></div></div>;
  if (!adminChecked) return <LoadingScreen label="Verifying operator access" />;
  if (!isAdmin) return <AccessDenied email={user?.primaryEmailAddress?.emailAddress} onRetry={() => api.getMe().then((me) => { setIsAdmin(me.isAdmin); setAdminChecked(true); }).catch(() => {})} />;
  return <Layout route={route} onNavigate={navigate}>{renderPage(route)}</Layout>;
}

function LoadingScreen({ label }: { label: string }) {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><div className="w-full max-w-xs space-y-4 p-6 text-center"><div className="mx-auto h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full w-1/2 animate-pulse rounded-full bg-primary" /></div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p></div></div>;
}

export default function App() {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState(false);
  useEffect(() => {
    fetch("/api/admin/config").then((response) => response.json()).then((data) => setPublishableKey(data.publishableKey || null)).catch(() => setKeyError(true));
  }, []);
  if (keyError) return <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-sm text-destructive"><div className="flex items-center gap-2"><CircleHelp size={16} />Failed to connect to API server.</div></div>;
  if (!publishableKey) return <LoadingScreen label="Connecting to Gamejo" />;
  return <ClerkProvider publishableKey={publishableKey} routerPush={() => {}} routerReplace={() => {}}><AdminApp /></ClerkProvider>;
}