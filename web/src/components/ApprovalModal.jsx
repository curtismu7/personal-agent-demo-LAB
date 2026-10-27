import { useEffect, useRef, useState } from "react";
import { workspaceFetch } from "../workspace";
import "./ApprovalModal.css";

// A held action: the policy engine answered "approval required", so the member decides on a modal they cannot miss.
// Simulated: no push goes to a phone and nothing is sent anywhere; the decision lives in this component only.
export default function ApprovalModal({ brand, onClose }) {
  const [decision, setDecision] = useState(null);
  const [problem, setProblem] = useState(null);
  // The decision lives on the server, per workspace: reopening shows it, Reset clears it, another tab never sees it.
  useEffect(() => {
    let live = true;
    workspaceFetch("/api/hold").then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j && j.decision) setDecision(j.decision); }, () => {});
    return () => { live = false; };
  }, []);
  const decide = async (value) => {
    setProblem(null);
    try {
      const r = await workspaceFetch("/api/hold/decision", { method: "POST", body: JSON.stringify({ decision: value }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDecision((await r.json()).decision);
    } catch { setProblem("Could not record the decision. Try again."); }
  };
  const first = useRef(null);
  const dialog = useRef(null);
  // Focus moves in on open and on each decision, and returns to the opener on close.
  const opener = useRef(typeof document === "undefined" ? null : document.activeElement);
  useEffect(() => { first.current?.focus(); }, [decision]);
  useEffect(() => () => { opener.current?.focus?.(); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      // Trap focus inside the dialog.
      const items = [...(dialog.current?.querySelectorAll("button") || [])];
      if (!items.length) return;
      const firstEl = items[0]; const lastEl = items[items.length - 1];
      if (!dialog.current.contains(document.activeElement)) { e.preventDefault(); firstEl.focus(); }
      else if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="apm-backdrop" data-testid="approval-backdrop">
      <section className="apm" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="apm-title" data-testid="approval">
        <h2 id="apm-title">{decision ? (decision === "approved" ? "Approved" : "Declined") : "Approval required"}</h2>
        {!decision ? (
          <>
            <p>The assistant asked for <strong>sensitive benefit details</strong>. The policy engine returned <b>approval required</b>, so the gateway held the call.</p>
            <pre className="apm-wire">{`action: benefits.read.sensitive\nverdict: HOLD (human approval)\n(illustrative: a real receipt is single use and short-lived)`}</pre>
            <p className="apm-note">Simulated approval. No push is sent to a real phone and nothing leaves this page. In production this happens in {brand}'s own app, never in the assistant chat.</p>
            {problem && <p role="alert" className="apm-note">{problem}</p>}
            <div className="apm-actions">
              <button type="button" ref={first} onClick={() => decide("approved")}>Approve</button>
              <button type="button" onClick={() => decide("declined")}>Decline</button>
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
