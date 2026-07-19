import { useEffect, useState } from "react";
import { ClerkProvider, SignIn, useAuth, useUser } from "@clerk/clerk-react";
import { api, setTokenGetter } from "./api";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import ContentPage from "./pages/ContentPage";
import ReportsPage from "./pages/ReportsPage";
import EventsPage from "./pages/EventsPage";
import EffectsPage from "./pages/EffectsPage";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "users",     label: "Users",     icon: "⊹" },
  { id: "content",   label: "Content",   icon: "▦" },
  { id: "events",    label: "Events",    icon: "✦" },
  { id: "effects",   label: "Effects",   icon: "✧" },
  { id: "reports",   label: "Reports",   icon: "⚑" },
] as const;
type Page = (typeof NAV)[number]["id"];

// ── Access Denied screen ─────────────────────────────────────────────────────

function AccessDenied({ email, onRetry, onSetup }: {
  email?: string;
  onRetry: () => void;
  onSetup: () => void;
}) {
  const [setting, setSetting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSetup = async () => {
    setSetting(true);
    setError(null);
    try { await onSetup(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSetting(false); }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center max-w-sm w-full space-y-5 p-8 bg-card rounded-2xl border shadow-sm">
        <div className="text-5xl">✦</div>
        <div>
          <h2 className="text-xl font-semibold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleSetup}
            disabled={setting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {setting ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Claiming…</>
            ) : (
              "Claim first-admin access"
            )}
          </button>
          <p className="text-xs text-muted-foreground">
            Only works while no admin exists yet — then it's locked.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button onClick={onRetry} className="text-xs text-muted-foreground hover:text-foreground underline transition-colors">
          Already have access? Retry
        </button>
      </div>
    </div>
  );
}

// ── Sidebar + layout ─────────────────────────────────────────────────────────

function Layout({ children, page, setPage }: {
  children: React.ReactNode;
  page: Page;
  setPage: (p: Page) => void;
}) {
  const { signOut } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">✦</span>
            <div>
              <div className="text-sm font-semibold text-white">Sky Journal</div>
              <div className="text-xs text-sidebar-foreground/60">Admin Console</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                page === item.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <span className="w-5 text-center text-base">↩</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

// ── Admin guard ───────────────────────────────────────────────────────────────

function AdminApp() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [page, setPage] = useState<Page>("dashboard");
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Register the token getter so apiFetch can include the Clerk JWT
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);

  // Once signed in, check admin status
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    api.getMe()
      .then((me) => { setIsAdmin(me.isAdmin); setAdminChecked(true); })
      .catch(() => { setIsAdmin(false); setAdminChecked(true); });
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-3">✦</div>
            <h1 className="text-2xl font-semibold">Sky Journal Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to access the admin console</p>
          </div>
          <SignIn routing="hash" />
        </div>
      </div>
    );
  }

  if (!adminChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <AccessDenied
      email={user?.primaryEmailAddress?.emailAddress}
      onRetry={() => api.getMe().then(me => setIsAdmin(me.isAdmin)).catch(() => {})}
      onSetup={() =>
        api.setupAdmin()
          .then(() => api.getMe())
          .then(me => setIsAdmin(me.isAdmin))
          .catch((err: Error) => alert(err.message))
      }
    />;
  }

  return (
    <Layout page={page} setPage={setPage}>
      {page === "dashboard" && <DashboardPage />}
      {page === "users"     && <UsersPage />}
      {page === "content"   && <ContentPage />}
      {page === "events"    && <EventsPage />}
      {page === "effects"   && <EffectsPage />}
      {page === "reports"   && <ReportsPage />}
    </Layout>
  );
}

// ── Root: fetch Clerk key then mount ─────────────────────────────────────────

export default function App() {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [keyError, setKeyError]             = useState(false);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((d) => setPublishableKey(d.publishableKey || null))
      .catch(() => setKeyError(true));
  }, []);

  if (keyError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-red-600">Failed to connect to API server.</p>
      </div>
    );
  }

  if (!publishableKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} routerPush={() => {}} routerReplace={() => {}}>
      <AdminApp />
    </ClerkProvider>
  );
}
