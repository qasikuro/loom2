import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, CircleAlert, Clock3, Mail, Pause, RefreshCw, Send, ShieldCheck, Users, X } from "lucide-react";
import { api, type Campaign, type InterestAudience, type InterestSubscribersResponse } from "../api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const AUDIENCES: { value: InterestAudience; label: string; note: string }[] = [
  { value: "all", label: "All subscribers", note: "Everyone with active consent" },
  { value: "beta_tester", label: "Beta testers", note: "Subscribers interested in beta testing" },
  { value: "content_creator", label: "Content creators", note: "Subscribers interested in making stories" },
];

type PresetName = "Welcome" | "Beta is live" | "Perks";
type Draft = { subject: string; message: string };
const PERKS_PLACEHOLDER = "[Add confirmed perk details before sending.]";
const DEFAULT_PRESETS: Record<PresetName, Draft> = {
  Welcome: {
    subject: "A note from Storigam",
    message: "Hi,\n\nThanks for asking to hear from Storigam. We're building a place for stories that grow with the people who tell them.\n\nWe'll share meaningful updates here as the community takes shape.\n\nThe Storigam team",
  },
  "Beta is live": {
    subject: "The Storigam beta is open",
    message: "Hi,\n\nThe Storigam beta is live. If you'd like to join us and help shape what comes next, visit Storigam to get started.\n\nThank you for being here early.\n\nThe Storigam team",
  },
  Perks: {
    subject: "A little something for our early community",
    message: `Hi,\n\nWe wanted to share an update about perks for the early Storigam community. Here are the details:\n\n${PERKS_PLACEHOLDER}\n\nThe Storigam team`,
  },
};

function recipientFromLink(): string {
  return new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("to") ?? "";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed. Please try again.";
}

function audienceLabel(value: string): string {
  return AUDIENCES.find(item => item.value === value)?.label ?? value;
}

export default function EmailPage() {
  const [subscribers, setSubscribers] = useState<InterestSubscribersResponse | null>(null);
  const [subscriberLoading, setSubscriberLoading] = useState(true);
  const [subscriberError, setSubscriberError] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  const [presets, setPresets] = useState<Record<PresetName, Draft>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("storigam-email-presets") ?? "null") as Partial<Record<PresetName, Draft>> | null;
      return Object.fromEntries((Object.keys(DEFAULT_PRESETS) as PresetName[]).map(name => [
        name,
        saved?.[name] && typeof saved[name]?.subject === "string" && typeof saved[name]?.message === "string"
          ? saved[name] : DEFAULT_PRESETS[name],
      ])) as Record<PresetName, Draft>;
    } catch {
      return DEFAULT_PRESETS;
    }
  });
  const [selectedPreset, setSelectedPreset] = useState<PresetName | null>(null);
  const [audience, setAudience] = useState<InterestAudience>("all");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignReview, setCampaignReview] = useState<{ audience: InterestAudience; subject: string; message: string; count: number } | null>(null);
  const [campaignError, setCampaignError] = useState("");
  const [campaignNotice, setCampaignNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  const creatingRef = useRef(false);
  const dispatchingRef = useRef(false);
  const stopRef = useRef(false);

  const [to, setTo] = useState(recipientFromLink);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sendingRef = useRef(false);

  const loadSubscribers = useCallback(async () => {
    setSubscriberLoading(true);
    setSubscriberError("");
    try {
      setSubscribers(await api.getInterestSubscribers());
    } catch (err) {
      setSubscriberError(errorMessage(err));
    } finally {
      setSubscriberLoading(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await api.getInterestCampaigns();
      setCampaigns(result.campaigns);
    } catch (err) {
      setHistoryError(errorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubscribers();
    void loadCampaigns();
    return () => { stopRef.current = true; };
  }, [loadSubscribers, loadCampaigns]);

  function countFor(target: InterestAudience, data: InterestSubscribersResponse): number {
    return data.audienceCounts[target];
  }

  function editCampaign(field: keyof Draft, value: string) {
    if (field === "subject") setCampaignSubject(value);
    else setCampaignMessage(value);
    setCampaignReview(null);
    setCampaignNotice("");
    if (selectedPreset) {
      setPresets(previous => {
        const next = { ...previous, [selectedPreset]: { ...previous[selectedPreset], [field]: value } };
        try { localStorage.setItem("storigam-email-presets", JSON.stringify(next)); } catch { /* Browser storage may be unavailable. */ }
        return next;
      });
    }
  }

  function handlePresetSelect(name: PresetName) {
    setSelectedPreset(name);
    setCampaignSubject(presets[name].subject);
    setCampaignMessage(presets[name].message);
    setCampaignReview(null);
    setCampaignError("");
    setCampaignNotice("");
  }

  async function reviewCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingRef.current || dispatchingRef.current) return;
    setCampaignError("");
    setCampaignNotice("");
    if (!campaignSubject.trim() || !campaignMessage.trim()) {
      setCampaignError("Add a subject and message before reviewing.");
      return;
    }
    if (campaignMessage.includes(PERKS_PLACEHOLDER)) {
      setCampaignError("Replace the bracketed perk details with confirmed information before sending.");
      return;
    }
    setSubscriberLoading(true);
    try {
      const fresh = await api.getInterestSubscribers();
      setSubscribers(fresh);
      setSubscriberError("");
      const count = countFor(audience, fresh);
      if (!count) {
        setCampaignError("There are no active, consenting subscribers in this audience.");
        return;
      }
      setCampaignReview({ audience, subject: campaignSubject.trim(), message: campaignMessage.trim(), count });
    } catch (err) {
      setCampaignError(`Could not verify the audience: ${errorMessage(err)}`);
    } finally {
      setSubscriberLoading(false);
    }
  }

  function updateCampaign(campaign: Campaign) {
    setCampaigns(previous => [campaign, ...previous.filter(item => item.id !== campaign.id)]);
  }

  async function dispatchCampaign(campaign: Campaign) {
    if (dispatchingRef.current || creatingRef.current) return;
    if (campaign.pending <= 0 || campaign.uncertain > 0) return;
    dispatchingRef.current = true;
    stopRef.current = false;
    setStopRequested(false);
    setDispatchingId(campaign.id);
    setCampaignError("");
    let current = campaign;
    let haltedForIssue = false;
    try {
      while (current.pending > 0 && !stopRef.current) {
        const next = await api.dispatchInterestCampaign(current.id);
        updateCampaign(next);
        const rejected = next.failed > current.failed;
        const stalled = next.pending >= current.pending;
        current = next;
        if (next.uncertain > 0) {
          haltedForIssue = true;
          setCampaignError("Dispatch stopped: one or more deliveries are uncertain. Investigate before taking further action. This campaign cannot be resumed from here.");
          break;
        }
        if (rejected) {
          haltedForIssue = true;
          setCampaignError("Dispatch paused after the email provider rejected a recipient. Investigate the failure before resuming pending recipients from campaign history.");
          break;
        }
        if (stalled) {
          haltedForIssue = true;
          setCampaignError("Dispatch stopped because the pending count did not decrease. Check campaign status before trying again.");
          break;
        }
      }
      if (stopRef.current && current.pending > 0) {
        setCampaignNotice("Paused after the current batch. You can resume the remaining recipients from campaign history.");
      } else if (!haltedForIssue && current.pending === 0 && current.uncertain === 0) {
        setCampaignNotice("Campaign finished processing. Accepted means accepted by the email provider, not delivered to an inbox.");
      }
    } catch (err) {
      setCampaignError(`Dispatch could not be confirmed: ${errorMessage(err)}. Refresh history before resuming; the last batch may have been processed.`);
      await loadCampaigns();
    } finally {
      dispatchingRef.current = false;
      setDispatchingId(null);
      setStopRequested(false);
      void loadSubscribers();
    }
  }

  async function confirmCampaign() {
    if (creatingRef.current || dispatchingRef.current || !campaignReview) return;
    if (campaignReview.message.includes(PERKS_PLACEHOLDER)) {
      setCampaignReview(null);
      setCampaignError("Replace the bracketed perk details with confirmed information before sending.");
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    setCampaignError("");
    let created: Campaign;
    try {
      created = await api.createInterestCampaign({
        audience: campaignReview.audience,
        subject: campaignReview.subject,
        message: campaignReview.message,
      });
      updateCampaign(created);
      setCampaignReview(null);
      setCampaignNotice(`Campaign created for ${created.total.toLocaleString()} recipients. ${created.total !== campaignReview.count ? "The actual recipient count changed since review. " : ""}Processing recipients in batches of 10.`);
    } catch (err) {
      setCampaignError(`Could not confirm campaign creation: ${errorMessage(err)}. Check history before trying again to avoid a duplicate campaign.`);
      void loadCampaigns();
      creatingRef.current = false;
      setCreating(false);
      return;
    }
    creatingRef.current = false;
    setCreating(false);
    if (created.pending > 0 && created.uncertain === 0) {
      await dispatchCampaign(created);
    } else if (created.uncertain > 0) {
      setCampaignError("The new campaign has uncertain deliveries. Investigate before taking further action.");
    }
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!to.trim() || !subject.trim() || !message.trim()) {
      setError("Recipient, subject, and message are required.");
      return;
    }
    setError("");
    setSuccess("");
    setReviewing(true);
  }

  async function send() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    try {
      const result = await api.sendEmail({ to: to.trim(), subject: subject.trim(), message: message.trim() });
      setSuccess(`Email accepted by Resend for delivery. Reference: ${result.id}`);
      setSubject("");
      setMessage("");
      setReviewing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the send. Check Resend before retrying.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const activeCount = subscribers ? countFor(audience, subscribers) : null;
  const optedOut = subscribers ? subscribers.total - subscribers.activeTotal : null;

  return (
    <div className="admin-enter mx-auto max-w-6xl space-y-8 p-5 pb-20 sm:p-8 lg:p-10">
      <header className="space-y-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          <span>Communication</span><ArrowRight size={12} /><span>Email</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Write to the people waiting.</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Reach consenting future members with a considered update, or send a direct note to one person. Review every message before it leaves.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Users size={15} /> Active subscribers</div>
          <div data-testid="text-active-subscribers" className="mt-3 text-3xl font-semibold tabular-nums">{subscribers ? subscribers.activeTotal.toLocaleString() : "—"}</div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><X size={15} /> Opted out</div>
          <div data-testid="text-opted-out" className="mt-3 text-3xl font-semibold tabular-nums">{optedOut === null ? "—" : optedOut.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Mail size={15} /> Campaigns</div>
          <div data-testid="text-campaign-count" className="mt-3 text-3xl font-semibold tabular-nums">{historyLoading && !campaigns.length ? "—" : campaigns.length.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Send size={18} /></span>
            <div><h2 className="text-base font-semibold">Campaign composer</h2><p className="text-xs text-muted-foreground">Only subscribers who opted in</p></div>
          </div>
          <form onSubmit={reviewCampaign} className="space-y-6 p-5 sm:p-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">01 / Starting point</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DEFAULT_PRESETS) as PresetName[]).map(name => (
                  <button key={name} type="button" data-testid={`button-preset-${name.toLowerCase().replaceAll(" ", "-")}`}
                    disabled={creating || !!dispatchingId} onClick={() => handlePresetSelect(name)}
                    className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${selectedPreset === name ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
                    {name}
                  </button>
                ))}
                <button type="button" data-testid="button-preset-blank" disabled={creating || !!dispatchingId}
                  onClick={() => { setSelectedPreset(null); setCampaignSubject(""); setCampaignMessage(""); setCampaignReview(null); setCampaignError(""); }}
                  className="rounded-full border bg-background px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Start blank</button>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {selectedPreset ? `Editing “${selectedPreset}” saves your changes in this browser. Check all details before sending.` : "Pick a starting point or write your own message."}
              </p>
            </div>

            <fieldset disabled={creating || !!dispatchingId} className="space-y-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">02 / Audience</legend>
              {AUDIENCES.map(item => (
                <label key={item.value} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${audience === item.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="campaign-audience" data-testid={`radio-audience-${item.value}`} checked={audience === item.value}
                      onChange={() => { setAudience(item.value); setCampaignReview(null); setCampaignNotice(""); }} className="accent-[hsl(var(--primary))]" />
                    <span><span className="block text-sm font-semibold">{item.label}</span><span className="text-xs text-muted-foreground">{item.note}</span></span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{subscribers ? countFor(item.value, subscribers).toLocaleString() : "—"}</span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">03 / Message</p>
              <div className="space-y-1.5">
                <label htmlFor="campaign-subject" className="text-sm font-medium">Subject</label>
                <Input id="campaign-subject" data-testid="input-campaign-subject" required maxLength={200} placeholder="What should they know?"
                  value={campaignSubject} disabled={creating || !!dispatchingId} onChange={event => editCampaign("subject", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="campaign-message" className="text-sm font-medium">Plain-text message</label>
                <textarea id="campaign-message" data-testid="input-campaign-message" required maxLength={10000} rows={12}
                  placeholder="Write the update you would want to receive…" value={campaignMessage} disabled={creating || !!dispatchingId}
                  onChange={event => editCampaign("message", event.target.value)}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <p className="text-right text-xs text-muted-foreground">{campaignMessage.length}/10,000</p>
              </div>
            </div>
            <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
              The server appends unsubscribe instructions automatically. Replies are not collected until an inbox is configured.
            </p>
            {campaignError && <p role="alert" data-testid="error-campaign" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{campaignError}</p>}
            {campaignNotice && <p role="status" data-testid="status-campaign" className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">{campaignNotice}</p>}
            {campaignReview ? (
              <div className="space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} className="text-primary" /> Final review</div>
                <p className="text-sm">This will create a campaign for <strong data-testid="text-review-audience-count">{campaignReview.count.toLocaleString()}</strong> currently matching, consenting subscribers in <strong>{audienceLabel(campaignReview.audience)}</strong>. The server determines the final recipients at creation.</p>
                <div className="space-y-2 rounded-lg border bg-card p-4">
                  <p className="break-words text-sm font-semibold">{campaignReview.subject}</p>
                  <p className="max-h-56 overflow-auto whitespace-pre-wrap break-words border-t pt-3 text-sm leading-6">{campaignReview.message}</p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">Sending starts immediately after confirmation, in batches of 10. Pausing stops after the current batch. The server adds unsubscribe instructions.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" data-testid="button-edit-campaign" disabled={creating || !!dispatchingId} onClick={() => setCampaignReview(null)}>Edit message</Button>
                  <Button type="button" data-testid="button-confirm-campaign" disabled={creating || !!dispatchingId} onClick={confirmCampaign}>
                    <Send size={15} className="mr-2" />{creating ? "Creating campaign…" : "Confirm & begin sending"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="submit" data-testid="button-review-campaign" disabled={creating || !!dispatchingId || subscriberLoading || !subscribers || !campaignSubject.trim() || !campaignMessage.trim() || activeCount === 0}>
                {subscriberLoading ? "Checking subscribers…" : "Review campaign"} <ArrowRight size={15} className="ml-2" />
              </Button>
            )}
          </form>
        </section>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div><h2 className="text-sm font-semibold">Subscriber ledger</h2><p className="text-xs text-muted-foreground">Consent and interests</p></div>
              <Button type="button" size="sm" variant="ghost" data-testid="button-refresh-subscribers" disabled={subscriberLoading} onClick={() => void loadSubscribers()} aria-label="Refresh subscribers"><RefreshCw size={15} /></Button>
            </div>
            {subscriberLoading && !subscribers ? (
              <div className="space-y-3 p-5" aria-label="Loading subscribers"><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /><div className="h-4 w-1/2 animate-pulse rounded bg-muted" /><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /></div>
            ) : subscriberError && !subscribers ? (
              <div className="space-y-3 p-5 text-sm"><p role="alert" className="text-destructive">{subscriberError}</p><Button size="sm" variant="outline" onClick={() => void loadSubscribers()}>Retry</Button></div>
            ) : (
              <>
                {subscriberError && <p role="alert" className="px-5 pt-4 text-xs text-destructive">Could not refresh: {subscriberError}. Counts may be outdated.</p>}
                {subscribers && subscribers.subscribers.length < subscribers.total && (
                  <p className="border-b px-5 py-3 text-xs leading-5 text-muted-foreground">
                    Showing the latest {subscribers.subscribers.length.toLocaleString()} of {subscribers.total.toLocaleString()} subscriber records. Audience counts include the full database, not just this list.
                  </p>
                )}
                <div className="max-h-[510px] overflow-auto divide-y">
                  {subscribers?.subscribers.length ? subscribers.subscribers.map((person, index) => (
                    <div key={`${person.email}-${index}`} data-testid={`row-subscriber-${index}`} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-all text-xs font-semibold">{person.email}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${person.unsubscribedAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>{person.unsubscribedAt ? "Opted out" : "Consented"}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Consented {formatDate(person.consentedAt)}</p>
                      {person.interests.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{person.interests.map(interest => <span key={interest} className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{audienceLabel(interest)}</span>)}</div>}
                    </div>
                  )) : <div className="p-5 text-sm leading-6 text-muted-foreground">{subscribers?.total ? "No subscriber records were returned in this list. Audience counts still reflect the full database." : "No subscribers yet. When people opt in, they will appear here."}</div>}
                </div>
              </>
            )}
          </section>
          <div className="rounded-2xl border bg-card p-5">
            <ShieldCheck size={19} className="text-primary" />
            <h3 className="mt-3 text-sm font-semibold">A deliberate send</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Only active, consenting interest subscribers are eligible for campaigns. Opted-out addresses remain visible here for audit, but are excluded from sends.</p>
          </div>
        </aside>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <div><h2 className="text-base font-semibold">Campaign history</h2><p className="text-xs text-muted-foreground">Provider acceptance is not proof of inbox delivery</p></div>
          <Button type="button" size="sm" variant="outline" data-testid="button-refresh-campaigns" disabled={historyLoading || !!dispatchingId} onClick={() => void loadCampaigns()}><RefreshCw size={14} className="mr-2" /> Refresh</Button>
        </div>
        {historyLoading && !campaigns.length ? (
          <div className="space-y-3 p-6" aria-label="Loading campaigns"><div className="h-5 w-2/3 animate-pulse rounded bg-muted" /><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /></div>
        ) : historyError && !campaigns.length ? (
          <div className="space-y-3 p-6 text-sm"><p role="alert" className="text-destructive">{historyError}</p><Button size="sm" variant="outline" onClick={() => void loadCampaigns()}>Retry</Button></div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center"><Clock3 size={22} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Nothing sent yet</p><p className="mt-1 text-xs text-muted-foreground">Reviewed campaigns and their recipient counts will appear here.</p></div>
        ) : (
          <div className="divide-y">
            {historyError && <p role="alert" className="p-4 text-xs text-destructive">Could not refresh history: {historyError}</p>}
            {campaigns.map(campaign => {
              const processed = campaign.total - campaign.pending;
              const active = dispatchingId === campaign.id;
              return (
                <article key={campaign.id} data-testid={`card-campaign-${campaign.id}`} className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-sm font-semibold">{campaign.subject}</h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{audienceLabel(campaign.audience)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(campaign.createdAt)} · {campaign.total.toLocaleString()} recipients</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {active && <Button type="button" size="sm" variant="outline" data-testid={`button-pause-campaign-${campaign.id}`} disabled={stopRequested} onClick={() => { stopRef.current = true; setStopRequested(true); }}><Pause size={14} className="mr-1.5" />{stopRequested ? "Pausing…" : "Pause"}</Button>}
                      {!active && campaign.pending > 0 && campaign.uncertain === 0 && (
                        <Button type="button" size="sm" variant="outline" data-testid={`button-resume-campaign-${campaign.id}`} disabled={creating || !!dispatchingId} onClick={() => void dispatchCampaign(campaign)}><Send size={14} className="mr-1.5" />Resume pending</Button>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Campaign ${campaign.subject} processed`} aria-valuenow={processed} aria-valuemin={0} aria-valuemax={campaign.total}>
                    <div className="h-full rounded-full bg-primary transition-transform duration-300" style={{ width: "100%", transform: `translateX(-${campaign.total ? (campaign.pending / campaign.total) * 100 : 0}%)` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                    <span data-testid={`text-accepted-${campaign.id}`}><Check size={12} className="mr-1 inline text-primary" />{campaign.accepted} accepted</span>
                    <span>{campaign.pending} pending</span><span>{campaign.failed} failed</span><span>{campaign.skipped} skipped</span><span className={campaign.uncertain ? "font-bold text-destructive" : ""}>{campaign.uncertain} uncertain</span>
                  </div>
                  {campaign.uncertain > 0 && <p className="flex items-start gap-2 text-xs leading-5 text-destructive"><CircleAlert size={14} className="mt-0.5 shrink-0" />Delivery outcome uncertain. Investigate before resuming; automatic dispatch is blocked.</p>}
                  {campaign.failed > 0 && <p className="text-xs text-muted-foreground">{campaign.pending > 0 ? "A recipient was rejected by the provider. Investigate before resuming pending sends. " : "Some recipients failed. "}This console does not retry failed sends automatically.</p>}
                  <details className="text-xs text-muted-foreground">
                    <summary data-testid={`button-view-campaign-${campaign.id}`} className="cursor-pointer select-none font-medium hover:text-foreground">View sent copy</summary>
                    <div className="mt-3 rounded-lg border bg-background p-4"><p className="font-semibold text-foreground">{campaign.subject}</p><p className="mt-3 whitespace-pre-wrap break-words leading-5">{campaign.message}</p></div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Mail size={18} /></span>
            <div><h2 className="text-sm font-semibold">Direct email</h2><p className="text-xs text-muted-foreground">Single recipient · plain text</p></div>
          </div>
          <form onSubmit={review} className="space-y-5 p-5">
            <div className="space-y-1.5">
              <label htmlFor="email-to" className="text-sm font-medium">Recipient email</label>
              <Input id="email-to" data-testid="input-email-to" type="email" autoComplete="off" required maxLength={254}
                placeholder="name@example.com" value={to} disabled={sending}
                onChange={event => { setTo(event.target.value); setReviewing(false); setSuccess(""); }} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email-subject" className="text-sm font-medium">Subject</label>
              <Input id="email-subject" data-testid="input-email-subject" type="text" required maxLength={200}
                placeholder="What is this about?" value={subject} disabled={sending}
                onChange={event => { setSubject(event.target.value); setReviewing(false); setSuccess(""); }} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email-message" className="text-sm font-medium">Message</label>
              <textarea id="email-message" data-testid="input-email-message" required maxLength={10000} rows={10}
                placeholder="Write your message here…" value={message} disabled={sending}
                onChange={event => { setMessage(event.target.value); setReviewing(false); setSuccess(""); }}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-right text-xs text-muted-foreground">{message.length}/10,000</p>
            </div>
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {success && <p role="status" data-testid="email-success" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{success}</p>}
            {reviewing ? (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-semibold">Ready to send a real email?</p>
                <dl className="space-y-1 text-sm">
                  <div className="flex gap-2"><dt className="text-muted-foreground">To:</dt><dd className="break-all font-medium">{to.trim()}</dd></div>
                  <div className="flex gap-2"><dt className="text-muted-foreground">Subject:</dt><dd className="font-medium">{subject.trim()}</dd></div>
                </dl>
                <p className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-card p-3 text-sm">{message.trim()}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={sending}>Edit</Button>
                  <Button type="button" data-testid="button-confirm-email" onClick={send} disabled={sending}>
                    <Send size={15} className="mr-2" />{sending ? "Sending…" : "Send now"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="submit" data-testid="button-review-email" disabled={sending}>
                Review email <ArrowRight size={15} className="ml-2" />
              </Button>
            )}
          </form>
        </section>
        <aside className="h-fit rounded-2xl border bg-card p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck size={19} /></div>
          <h2 className="text-sm font-semibold">Connected to Resend</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Direct email is sent from the verified Storigam domain. The provider connection and sender settings stay on the API server, never in this browser.
          </p>
          <p className="mt-4 border-t pt-4 text-xs leading-5 text-muted-foreground">
            The default sender is a no-reply address. Replies are not collected until an inbox is configured; they do not appear in this admin panel.
          </p>
        </aside>
      </div>
    </div>
  );
}