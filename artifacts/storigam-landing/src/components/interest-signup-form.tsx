import {
  useSubmitStorigamInterest,
  type StorigamInterestInputInterestsItem,
} from "@workspace/api-client-react";
import { useState } from "react";
import type { LandingCopy } from "@/i18n/en";

const interestOptions: StorigamInterestInputInterestsItem[] = ["beta_tester", "content_creator"];

export default function InterestSignupForm({ copy }: { copy: LandingCopy }) {
  const submission = useSubmitStorigamInterest();
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<StorigamInterestInputInterestsItem[]>([]);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [interestError, setInterestError] = useState(false);

  const toggleInterest = (interest: StorigamInterestInputInterestsItem) => {
    submission.reset();
    setInterestError(false);
    setInterests((selected) =>
      selected.includes(interest)
        ? selected.filter((item) => item !== interest)
        : [...selected, interest],
    );
  };

  return (
    <form
      className="interest-form"
      aria-label={copy.formAria}
      aria-busy={submission.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (interests.length === 0) {
          setInterestError(true);
          return;
        }
        setInterestError(false);
        submission.mutate({
          data: { email: email.trim(), interests, consent, website },
        });
      }}
    >
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

      <fieldset className="interest-options">
        <legend>{copy.formLegend}</legend>
        {interestOptions.map((option) => (
          <label className="interest-option" key={option}>
            <input
              type="checkbox"
              checked={interests.includes(option)}
              onChange={() => toggleInterest(option)}
              data-testid={`checkbox-${option}`}
            />
            <span>{option === "beta_tester" ? copy.formBeta : copy.formCreator}</span>
          </label>
        ))}
        <span className="interest-hint">{copy.formHint}</span>
        {interestError && (
          <span className="interest-validation" role="alert">
            {copy.formValidation}
          </span>
        )}
      </fieldset>

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