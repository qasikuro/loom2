import { useState, type FormEvent } from "react";
import { ArrowRight, Mail, Send, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

function recipientFromLink(): string {
  return new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("to") ?? "";
}

export default function EmailPage() {
  const [to, setTo] = useState(recipientFromLink);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    if (sending) return;
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
      setSending(false);
    }
  }

  return (
    <div className="admin-enter mx-auto max-w-5xl space-y-7 p-5 sm:p-8 lg:p-10">
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          <span>Communication</span><ArrowRight size={12} /><span>Email</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Send an email</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Send a plain-text message to one recipient through Resend. You can also start here from a user’s profile.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Mail size={18} /></span>
            <div><h2 className="text-sm font-semibold">New message</h2><p className="text-xs text-muted-foreground">Single recipient · plain text</p></div>
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
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><ShieldCheck size={19} /></div>
          <h2 className="text-sm font-semibold">Connected to Resend</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Email is sent from the verified Storigam domain. The provider connection and sender settings stay on the API server, never in this browser.
          </p>
          <p className="mt-4 border-t pt-4 text-xs leading-5 text-muted-foreground">
            The default sender is a no-reply address. Recipients’ replies are not collected here.
          </p>
        </aside>
      </div>
    </div>
  );
}