import { useEffect, useRef, useState } from "react";
import "./ApprovalModal.css";

// A held action: the policy engine answered "approval required", so the member decides on a modal they cannot miss.
// Simulated: no push goes to a phone and nothing is sent anywhere; the decision lives in this component only.
export default function ApprovalModal({ brand, onClose }) {
  const [decision, setDecision] = useState(null);
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="apm-backdrop" data-testid="approval-backdrop">
      <section className="apm" role="dialog" aria-modal="true" aria-labelledby="apm-title" data-testid="approval">
        <h2 id="apm-title">{decision ? (decision === "approved" ? "Approved" : "Declined") : "Approval required"}</h2>
        {!decision ? (
          <>
            <p>The assistant asked for <strong>sensitive bookings</strong>. The policy engine returned <b>approval required</b>, so the gateway held the call.</p>
            <pre className="apm-wire">{`action: bookings.read.sensitive\nverdict: HOLD (human approval)\nsingle use · expires in 5 minutes`}</pre>
            <p className="apm-note">Simulated approval. No push is sent to a real phone and nothing leaves this page. In production this happens in {brand}'s own app, never in the assistant chat.</p>
            <div className="apm-actions">
              <button type="button" ref={first} onClick={() => setDecision("approved")}>Approve</button>
              <button type="button" onClick={() => setDecision("declined")}>Decline</button>
            </div>
          </>
        ) : (
          <>
            <p data-testid="approval-result">
              {decision === "approved"
                ? "The gateway retried the call with a single-use approval receipt. It was permitted, and only this one action was released."
                : "The call stays blocked. No receipt exists, the downstream API is never called, and a timeout would mean the same."}
            </p>
            <div className="apm-actions"><button type="button" ref={first} onClick={onClose}>Close</button></div>
          </>
        )}
      </section>
    </div>
  );
}
