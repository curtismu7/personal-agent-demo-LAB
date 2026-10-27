import { useCallback, useEffect, useMemo, useState } from "react";
import SequenceFlowDiagram from "./components/SequenceFlowDiagram";
import DiagramStepBar from "./components/DiagramStepBar";
import { useDiagramStepper } from "./hooks/useDiagramStepper";
import { REFIT_EVENT } from "./hooks/useFitOnResize";
import { wrapMessages } from "./wrapMessages";
import ApprovalModal from "./components/ApprovalModal";

// The hop the focused message belongs to (null while the walkthrough is off).
export const hopFor = (hops, step) => (step < 0 ? null : hops.find((h) => step >= h.first && step <= h.last) || null);

export default function App() {
  const [flow, setFlow] = useState(null);
  const [error, setError] = useState(null);
  const [presenter, setPresenter] = useState(false);
  const [holding, setHolding] = useState(false);
  const stepper = useDiagramStepper(flow ? flow.payloads.length : 0);

  useEffect(() => {
    let live = true;
    fetch("/api/flow").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => live && setFlow(j), (e) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  // A Learning Hub card opens a hop with /#hop-3.
  const goToHash = stepper.goTo;
  useEffect(() => {
    if (!flow) return;
    const m = /^#hop-(\d{1,2})$/.exec(window.location.hash);
    const h = m && flow.hops[Number(m[1]) - 1];
    if (h) goToHash(h.first);
  }, [flow, goToHash]);

  const source = useMemo(() => (flow ? wrapMessages(flow.source) : ""), [flow]);
  const hop = flow ? hopFor(flow.hops, stepper.step) : null;

  // Reset: stop the walkthrough and refit the diagram; the server call only confirms (the story is data).
  const reset = useCallback(() => {
    stepper.stop();
    window.dispatchEvent(new Event(REFIT_EVENT));
    fetch("/api/reset", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
  }, [stepper]);

  // Presenter keys: right = next (starts at hop 1), left = previous, Escape leaves presenter mode, P toggles it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /input|select|textarea/i.test(e.target?.tagName || "")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stepper.step < 0 ? stepper.goTo(0) : stepper.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepper.prev(); }
      else if (e.key === "Escape") setPresenter(false);
      else if (e.key === "p" || e.key === "P") setPresenter((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepper]);

  if (error) return <main className="app"><p role="alert" className="app-error">Could not load the walkthrough: {error}. Run <code>npm run doctor</code>.</p></main>;
  if (!flow) return <main className="app"><p>Loading…</p></main>;

  return (
    <main className={`app${presenter ? " app--presenter" : ""}`}>
      <div className="banner" role="note" data-testid="sim-banner">
        <strong>{flow.hosted ? "Hosted simulation." : "Simulated."}</strong> Every host, token and approval here is a teaching value. Nothing talks to a real tenant, and this page makes no call to one.
      </div>
      <header className="head">
        <div>
          <h1>{flow.title}</h1>
          {!presenter && <p className="intro">{flow.intro}</p>}
        </div>
        <div className="head__tools">
          <span className="chip" data-testid="mode">Mock · offline</span>
          <button type="button" onClick={() => setPresenter((v) => !v)} aria-pressed={presenter}>{presenter ? "Exit presenter" : "Presenter"}</button>
          <button type="button" onClick={() => setHolding(true)} title="Simulate a sensitive request that the policy engine holds for approval">Try a held request</button>
          <button type="button" onClick={reset} title="Stop the walkthrough, refit the diagram and reset the demo">Reset demo</button>
        </div>
      </header>

      <section className="track" aria-label="Talk track">
        {hop ? (
          <article className="track__now" data-testid="track-now">
            <h2>Step {hop.n}: {hop.title}</h2>
            <p>{hop.say}</p>
          </article>
        ) : (
          <ol className="track__list">
            {flow.hops.map((h) => (
              <li key={h.n}>
                <button type="button" onClick={() => stepper.goTo(h.first)}><b>{h.n}</b> {h.title}</button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <DiagramStepBar stepper={stepper} caption={hop ? hop.title : ""} />
      <SequenceFlowDiagram source={source} details={flow.details} payloads={flow.payloads} driver={stepper} label={flow.title} />
      {!presenter && <p className="keys">Keys: → next hop step, ← previous, P presenter, Esc leave presenter. Brand and names come from <code>customer.config.json</code>.</p>}
      {holding && <ApprovalModal brand={flow.cast?.brand || "the enterprise"} onClose={() => setHolding(false)} />}
    </main>
  );
}
