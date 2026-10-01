import {
  useSubmitStorigamInterest,
  type StorigamInterestInputInterestsItem,
} from "@workspace/api-client-react";
import { Mail } from "lucide-react";
import { useState } from "react";
import type { LandingCopy } from "@/i18n/en";

export default function InterestSignupForm({ copy }: { copy: LandingCopy }) {
  const submission = useSubmitStorigamInterest();
  const [email, setEmail] = useState("");
  const [creatorInterest, setCreatorInterest] = useState(false);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const interests: StorigamInterestInputInterestsItem[] = creatorInterest
    ? ["beta_tester", "content_creator"]
    : ["beta_tester"];

  return (
    <form
      id="waitlist"
      className="interest-form"
      aria-label={copy.formAria}
      aria-busy={submission.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        submission.mutate({
          data: { email: email.trim(), interests, consent, website },
        });
      }}
    >
      <div className="interest-form-heading">
        <span className="interest-form-icon" aria-hidden="true"><Mail size={20} /></span>
        <div>
          <h2>{copy.formLegend}</h2>
          <p>{copy.formHint}</p>
        </div>
      </div>

      <label className="interest-field" htmlFor="storigam-interest-email">
        <span>{copy.formEmail}</span>
        <input
          id="storigam-interest-email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => {
            submission.reset();
            setEmail(event.target.value);
          }}
          placeholder={copy.formEmailPlaceholder}
          data-testid="input-interest-email"
        />
      </label>

      <label className="interest-option interest-creator-option">
        <input
          type="checkbox"
          checked={creatorInterest}
          onChange={(event) => {
            submission.reset();
            setCreatorInterest(event.target.checked);
          }}
          data-testid="checkbox-content_creator"
        />
        <span>{copy.formCreator}</span>
      </label>

      <label className="interest-consent">
        <input
          type="checkbox"
          required
          checked={consent}
          data-testid="checkbox-interest-consent"
          onChange={(event) => {
            submission.reset();
            setConsent(event.target.checked);
          }}
        />
        <span>{copy.formConsent}</span>
      </label>

      <div className="interest-honeypot" aria-hidden="true">
        <label htmlFor="storigam-interest-website">{copy.formHoneypot}</label>
        <input
          id="storigam-interest-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <button
        className="button button-primary interest-submit"
        type="submit"
        disabled={submission.isPending || submission.isSuccess}
        data-testid="button-submit-interest"
      >
        {submission.isPending
          ? copy.formPending
          : submission.isSuccess
            ? copy.formSaved
            : copy.formSubmit}
      </button>

      <p className="interest-privacy">
        {copy.formPrivacy}
      </p>
      <p className="interest-status" role="status" aria-live="polite" data-testid="status-interest">
        {submission.isSuccess
          ? copy.formSuccess
          : submission.isError
            ? copy.formError
            : ""}
      </p>
    </form>
  );
}