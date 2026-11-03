// Rule 19: the Mock / Real toggle. This walkthrough is mock only (config.js refuses any other MODE), so
// Real is always disabled with the reason. It still renders in the header on every page.
const REAL_WHY = "Real is not available: this app has a mock mode only. A live side is not implemented.";

export default function ModeToggle({ info, onSelect }) {
  const loading = !info;
  const source = info?.source;
  const realOff = loading || info?.realAvailable !== true;
  const pick = (next) => { if (next !== source) onSelect?.(next); };
  return (
    <div className="mode-toggle" role="group" aria-label="Mode" data-testid="mode">
      <button type="button" aria-pressed={source === "mock"} disabled={loading} onClick={() => pick("mock")} data-testid="mode-mock">Mock</button>
      <button type="button" aria-pressed={source === "real"} disabled={realOff} title={realOff && !loading ? REAL_WHY : undefined} onClick={() => pick("real")} data-testid="mode-real">Real</button>
    </div>
  );
}
