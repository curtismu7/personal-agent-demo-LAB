import { useCallback, useEffect, useMemo, useState } from "react";
import fs from "node:fs";
import SequenceFlowDiagram from "./components/SequenceFlowDiagram";
import DiagramStepBar from "./components/DiagramStepBar";
import { useDiagramStepper } from "./hooks/useDiagramStepper";
import { REFIT_EVENT } from "./hooks/useFitOnResize";
import { wrapMessages } from "./wrapMessages";
import ApprovalModal from "./components/ApprovalModal";
import { workspaceFetch } from "./workspace";
import PatternDiagram from "./components/PatternDiagram";
import ShelfLink from "./components/ShelfLink.jsx";
import TopMenu, { applyFontSize } from "./top-menu/TopMenu.jsx";

const VERSION = (() => { try { return JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version || null; } catch { return null; } })();

// The hop the focused message belongs to (null while the walkthrough is off).
export const hopFor = (hops, step) => (step < 0 ? null : hops.find((h) => step >= h.first && step <= h.last) || null);

const THEME_KEY = "pad.theme";
function initialTheme() {
  try { const t = localStorage.getItem(THEME_KEY); if (t === "light" || t === "dark") return t; } catch { /* storage blocked */ }
  return "auto";
}

export default function App() {
  const [flow, setFlow] = useState(null);
  const [theme, setTheme] = useState(initialTheme);
  const [fontStep, setFontStep] = useState(() => { try { const f = localStorage.getItem("pad.font"); return ["S", "M", "L"].includes(f) ? f : "M"; } catch { return "M"; } });

  useEffect(() => { if (theme === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { applyFontSize(fontStep); try { localStorage.setItem("pad.font", fontStep); } catch { /* storage blocked */ } }, [fontStep]);

  const pickTheme = (next) => {
    try { if (next === "auto") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, next); } catch { /* not remembered */ }
    setTheme(next);
  };
  const [error, setError] = useState(null);
  const [presenter, setPresenter] = useState(false);
  const [holding, setHolding] = useState(false);
  const [pattern, setPattern] = useState(null);
  const [view, setView] = useState(window.location.hash === "#pattern" ? "pattern" : "steps");
  const stepper = useDiagramStepper(flow ? flow.payloads.length : 0);
  const [modeInfo, setModeInfo] = useState(null);
  useEffect(() => { fetch("/api/info").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then(setModeInfo).catch(() => {}); }, []);
  // Rule 19: the toggle asks the server; a refusal keeps the current mode on screen.
  const selectMode = async (source) => {
    try { const r = await fetch("/api/mode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) }); if (r.ok) setModeInfo(await r.json()); } catch { /* keep the current mode */ }
  };


  useEffect(() => {
    let live = true;
    fetch("/api/flow").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => live && setFlow(j), (e) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  const [patternPath, setPatternPath] = useState("privilege");
  useEffect(() => {
    let live = true;
    fetch(`/api/pattern?path=${patternPath}`).then((r) => (r.ok ? r.json() : null)).then((j) => live && j && setPattern(j), () => {});
    return () => { live = false; };
  }, [patternPath]);

  // A Learning Hub card opens a hop with /#hop-3.
  const goToHash = stepper.goTo;
  useEffect(() => {
    if (!flow) return undefined;
    const open = () => {
      const m = /^#hop-(\d{1,2})$/.exec(window.location.hash);
      const h = m && flow.hops[Number(m[1]) - 1];
      if (h) goToHash(h.first);
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [flow, goToHash]);

  const source = useMemo(() => (flow ? wrapMessages(flow.source) : ""), [flow]);
  const hop = flow ? hopFor(flow.hops, stepper.step) : null;

  // Reset: stop the walkthrough and refit the diagram; the server call only confirms (the story is data).
  const reset = useCallback(() => {
    stepper.stop();
    window.dispatchEvent(new Event(REFIT_EVENT));
    workspaceFetch("/api/reset", { method: "POST", body: "{}" }).catch(() => {});
  }, [stepper]);

  // Presenter keys: right = next (starts at hop 1), left = previous, Escape leaves presenter mode, P toggles it.
  useEffect(() => {
    const onKey = (e) => {
      if (holding) return; // the approval modal owns the keyboard while it is open
      if (e.metaKey || e.ctrlKey || e.altKey || /input|select|textarea/i.test(e.target?.tagName || "")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stepper.step < 0 ? stepper.goTo(0) : stepper.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepper.prev(); }
      else if (e.key === "Escape") setPresenter(false);
      else if (e.key === "p" || e.key === "P") setPresenter((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepper, holding]);

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
            <TopMenu
              mode={{ value: modeInfo?.source === "real" ? "real" : "mock", onChange: selectMode, realAvailable: modeInfo ? modeInfo.realAvailable === true : null, realHint: "Real is not available: this app has a mock mode only." }}
              theme={{ value: theme, onChange: pickTheme }}
              fontSize={{ value: fontStep, onChange: setFontStep }}
              present={{ active: presenter, onToggle: () => setPresenter((v) => !v) }}
              shelfUrl="https://local.ping-devops.com:8443/"
              help={{ href: "https://github.com/curtismu7/personal-agent-demo-LAB#readme" }}
              version={VERSION}
              onReset={reset}
            >
              <ShelfLink />
            </TopMenu>
          <button type="button" onClick={() => setHolding(true)} title="Simulate a sensitive request that the policy engine holds for approval">Try a held request</button>
        </div>
      </header>

      {pattern && (
        <nav className="views" aria-label="View">
          <button type="button" aria-pressed={view === "pattern"} onClick={() => setView("pattern")}>Pattern</button>
          <button type="button" aria-pressed={view === "steps"} onClick={() => setView("steps")}>12 steps</button>
        </nav>
      )}
      {view === "pattern" && pattern ? <PatternDiagram key={patternPath} pattern={pattern} path={patternPath} onPath={setPatternPath} /> : <>
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
      </>}
      {holding && <ApprovalModal brand={flow.cast?.brand || "the enterprise"} onClose={() => setHolding(false)} />}
    </main>
  );
}
