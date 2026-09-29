import {
  useSubmitStorigamInterest,
  type StorigamInterestInputInterestsItem,
} from "@workspace/api-client-react";
import { useState } from "react";

const interestOptions: {
  value: StorigamInterestInputInterestsItem;
  label: string;
}[] = [
  { value: "beta_tester", label: "Become a beta tester" },
  { value: "content_creator", label: "Become a content creator" },
];

export default function InterestSignupForm() {
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
      aria-label="Storigam beta tester and content creator interest"
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
        <span>Email address</span>
        <input
          id="storigam-interest-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => {
            submission.reset();
            setEmail(event.target.value);
          }}
          placeholder="you@example.com"
        />
      </label>

      <fieldset className="interest-options">
        <legend>How would you like to be part of it?</legend>
        {interestOptions.map((option) => (
          <label className="interest-option" key={option.value}>
            <input
              type="checkbox"
              checked={interests.includes(option.value)}
              onChange={() => toggleInterest(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
        <span className="interest-hint">Choose one or both.</span>
        {interestError && (
          <span className="interest-validation" role="alert">
            Choose at least one option.
          </span>
        )}
      </fieldset>

      <label className="interest-consent">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => {
            submission.reset();
            setConsent(event.target.checked);
          }}
        />
        <span>I agree to be contacted about the programs I select.</span>
      </label>

      <div className="interest-honeypot" aria-hidden="true">
        <label htmlFor="storigam-interest-website">Leave this field empty</label>
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
      >
        {submission.isPending
          ? "Saving your interest…"
          : submission.isSuccess
            ? "Interest saved"
            : "Show my interest"}
      </button>

      <p className="interest-privacy">
        We’ll use your email only to contact you about the options you select.
      </p>
      <p className="interest-status" role="status" aria-live="polite">
        {submission.isSuccess
          ? "Thanks — your interest is saved. We’ll be in touch."
          : submission.isError
            ? "We couldn’t save your interest. Please try again."
            : ""}
      </p>
    </form>
  );
}