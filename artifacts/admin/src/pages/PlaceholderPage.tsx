import { ArrowUpRight, CircleDashed, Construction } from "lucide-react";

interface PlaceholderPageProps {
  section: string;
  label: string;
  description?: string;
}

export default function PlaceholderPage({ section, label, description }: PlaceholderPageProps) {
  return (
    <div className="admin-enter min-h-full p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <span>{section}</span>
          <span className="text-primary">/</span>
          <span className="text-foreground">{label}</span>
        </div>
        <div className="relative overflow-hidden rounded-2xl border bg-card p-7 shadow-[0_18px_50px_rgba(44,35,86,0.06)] sm:p-12">
          <div className="absolute right-0 top-0 h-48 w-48 translate-x-16 -translate-y-16 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Construction size={22} strokeWidth={1.8} />
            </div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">Not connected yet</p>
            <h1 className="text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">{label}</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
              {description ?? `The ${label.toLowerCase()} workspace is mapped into the Gamejo command center, but its data connection has not been added yet.`}
            </p>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/40 p-4">
                <CircleDashed size={17} className="mb-3 text-muted-foreground" />
                <p className="text-sm font-semibold">Honest by default</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">No placeholder records or simulated actions are shown here.</p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <ArrowUpRight size={17} className="mb-3 text-muted-foreground" />
                <p className="text-sm font-semibold">Ready for wiring</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">This route is in place so operators can find it as the API ships.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}