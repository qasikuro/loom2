import { useEffect, useState, useCallback } from "react";
import { api, type Report } from "../api";

const STATUS_TABS = ["pending", "resolved", "dismissed", "all"] as const;

export default function ReportsPage() {
  const [status, setStatus]   = useState<string>("pending");
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal]     = useState(0);
  const [offset, setOffset]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [toast, setToast]     = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async (s: string, off: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getReports(s, off);
      setReports(data.reports);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(status, offset); }, [status, offset]);

  const handle = async (id: string, action: "resolved" | "dismissed" | "delete") => {
    try {
      if (action === "delete") await api.deleteReport(id);
      else await api.resolveReport(id, action);
      showToast("Done!");
      load(status, offset);
    } catch (e: any) {
      showToast("Error: " + e.message);
    }
  };

  const statusColor = (s: string) =>
    s === "pending"   ? "bg-orange-100 text-orange-700" :
    s === "resolved"  ? "bg-green-100 text-green-700" :
    s === "dismissed" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700";

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reports & Complaints</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and action user-submitted reports</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setStatus(t); setOffset(0); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium capitalize transition-colors ${status === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
          >{t}</button>
        ))}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/20">
          <span className="text-sm font-medium">{total} {status === "all" ? "total" : status} reports</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Report</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Target</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No {status} reports</td></tr>
              ) : reports.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.reason}</div>
                    {r.details && <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{r.details}</div>}
                    <div className="text-xs text-muted-foreground/60 font-mono mt-0.5">by {r.reporterId.slice(0, 16)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-muted font-medium capitalize">{r.targetType}</span>
                    <div className="text-xs text-muted-foreground font-mono mt-1">{r.targetId.slice(0, 16)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {r.status === "pending" && (
                        <>
                          <button onClick={() => handle(r.id, "resolved")}
                            className="px-2 py-1 text-xs rounded-md font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                            Resolve
                          </button>
                          <button onClick={() => handle(r.id, "dismissed")}
                            className="px-2 py-1 text-xs rounded-md font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                            Dismiss
                          </button>
                        </>
                      )}
                      <button onClick={() => handle(r.id, "delete")}
                        className="px-2 py-1 text-xs rounded-md font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                        Delete
                      </button>
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

      {toast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
