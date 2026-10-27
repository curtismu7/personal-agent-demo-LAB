import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import App, { hopFor } from "./App.jsx";

const FLOW = {
  title: "How an AI assistant reaches Test Air's member benefits",
  intro: "intro text",
  source: "sequenceDiagram\n    autonumber\n    participant A as Agent\\nx\n    participant B as Door\\ny\n    A->>B: first message\n    B-->>A: second message\n    A->>B: third message",
  payloads: ["a: 1", null, "b: 2"],
  details: { A: "agent detail", B: "door detail" },
  hops: [{ n: 1, title: "Discover", first: 0, last: 1, say: "say one" }, { n: 2, title: "Call", first: 2, last: 2, say: "say two" }],
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); for (const k of Object.keys(holds)) delete holds[k]; });
const holds = {};
const mockFetch = (flow = FLOW) => vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
  const u = String(url);
  const ws = (opts.headers || {})["x-workspace"] || "none";
  if (u.endsWith("/api/flow")) return { ok: true, json: async () => flow };
  if (u.endsWith("/api/hold")) return { ok: true, json: async () => ({ workspace: ws, decision: holds[ws] || null }) };
  if (u.endsWith("/api/hold/decision")) { holds[ws] = JSON.parse(opts.body).decision; return { ok: true, json: async () => ({ workspace: ws, decision: holds[ws] }) }; }
  if (u.endsWith("/api/reset")) { delete holds[ws]; return { ok: true, json: async () => ({ reset: "ok", workspace: ws }) }; }
  return { ok: true, json: async () => ({}) };
});

describe("hopFor", () => {
  it("maps a step to its hop and is null when the walkthrough is off", () => {
    expect(hopFor(FLOW.hops, -1)).toBeNull();
    expect(hopFor(FLOW.hops, 1).n).toBe(1);
    expect(hopFor(FLOW.hops, 2).n).toBe(2);
    expect(hopFor(FLOW.hops, 9)).toBeNull();
  });
});

describe("App", () => {
  it("always shows the simulation banner and the mock mode, with the story title", async () => {
    mockFetch();
    render(<App />);
    expect(await screen.findByText(/reaches Test Air/)).toBeTruthy();
    expect(screen.getByTestId("sim-banner").textContent).toMatch(/Simulated/);
    expect(screen.getByTestId("mode").textContent).toMatch(/Mock/);
  });

  it("a #hop-2 link opens that hop", async () => {
    window.location.hash = "#hop-2";
    mockFetch();
    render(<App />);
    await waitFor(() => expect(screen.getByTestId("track-now").textContent).toMatch(/say two/));
    window.location.hash = "";
  });

  it("the hosted build's banner says hosted simulation", async () => {
    mockFetch({ ...FLOW, hosted: true });
    render(<App />);
    await screen.findByText(/reaches Test Air/);
    expect(screen.getByTestId("sim-banner").textContent).toMatch(/Hosted simulation/);
  });

  it("picking a hop on the talk track jumps to it and shows what to say", async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/reaches Test Air/);
    fireEvent.click(screen.getByRole("button", { name: /Call/ }));
    await waitFor(() => expect(screen.getByTestId("track-now").textContent).toMatch(/say two/));
  });

  it("presenter mode keeps the banner; the arrow keys walk the hops; Reset returns to the list", async () => {
    const spy = mockFetch();
    render(<App />);
    await screen.findByText(/reaches Test Air/);
    fireEvent.click(screen.getByRole("button", { name: "Presenter" }));
    expect(screen.getByTestId("sim-banner")).toBeTruthy();
    expect(screen.queryByText("intro text")).toBeNull();
    act(() => { fireEvent.keyDown(window, { key: "ArrowRight" }); });
    await waitFor(() => expect(screen.getByTestId("track-now").textContent).toMatch(/say one/));
    act(() => { fireEvent.keyDown(window, { key: "ArrowRight" }); fireEvent.keyDown(window, { key: "ArrowRight" }); });
    await waitFor(() => expect(screen.getByTestId("track-now").textContent).toMatch(/say two/));
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    await waitFor(() => expect(screen.queryByTestId("track-now")).toBeNull());
    expect(spy.mock.calls.some(([u, o]) => String(u).endsWith("/api/reset") && o?.method === "POST")).toBe(true);
  });

  it("a held request opens a modal; Approve releases one action, Decline keeps it blocked", async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/reaches Test Air/);
    fireEvent.click(screen.getByRole("button", { name: "Try a held request" }));
    expect(screen.getByRole("dialog").textContent).toMatch(/Approval required/);
    expect(screen.getByRole("dialog").textContent).toMatch(/Simulated approval/);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect((await screen.findByTestId("approval-result")).textContent).toMatch(/single-use approval receipt/);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try a held request" }));
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect((await screen.findByTestId("approval-result")).textContent).toMatch(/stays blocked/);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the modal traps Tab, keeps page keys out, restores focus, and Esc does not leave presenter mode", async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/reaches Test Air/);
    fireEvent.click(screen.getByRole("button", { name: "Presenter" }));
    const opener = screen.getByRole("button", { name: "Try a held request" });
    opener.focus();
    fireEvent.click(opener);
    const approve = screen.getByRole("button", { name: "Approve" });
    const decline = screen.getByRole("button", { name: "Decline" });
    expect(document.activeElement).toBe(approve);
    decline.focus();
    fireEvent.keyDown(decline, { key: "Tab" });
    expect(document.activeElement).toBe(approve);
    fireEvent.keyDown(approve, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(decline);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.queryByTestId("track-now")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Exit presenter" })).toBeTruthy();
    expect(document.activeElement).toBe(opener);
  });

  it("the decision is kept per workspace: reopening shows it, and Reset clears it", async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/reaches Test Air/);
    fireEvent.click(screen.getByRole("button", { name: "Try a held request" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByTestId("approval-result");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Try a held request" }));
    expect((await screen.findByTestId("approval-result")).textContent).toMatch(/single-use approval receipt/);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    await waitFor(() => expect(Object.keys(holds).length).toBe(0));
    fireEvent.click(screen.getByRole("button", { name: "Try a held request" }));
    expect(screen.getByRole("dialog").textContent).toMatch(/Approval required/);
  });

  it("a #hop-N change on the same page opens that hop", async () => {
    mockFetch();
    render(<App />);
    await screen.findByText(/reaches Test Air/);
    act(() => { window.location.hash = "#hop-2"; window.dispatchEvent(new HashChangeEvent("hashchange")); });
    await waitFor(() => expect(screen.getByTestId("track-now").textContent).toMatch(/say two/));
    window.location.hash = "";
  });

  it("says so when the story cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<App />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load/);
  });
});

describe("pattern view", () => {
  it("shows the Pattern tab, walks a step and Reset clears it", async () => {
    const pattern = { title: "P", intro: "pattern intro", nodes: [{ id: "a", label: "A", kind: "actor", x: 0, y: 0 }, { id: "b", label: "B", kind: "actor", x: 200, y: 0 }], steps: [{ from: "a", to: "b", label: "go", say: "say go", payload: '{"aud":"x"}' }], paths: [{ id: "privilege", label: "Agent Privilege" }, { id: "ig", label: "Agent Gateway (IG)" }] };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => ({ ok: true, json: async () => (String(url).includes("/api/pattern") ? pattern : String(url).endsWith("/api/flow") ? FLOW : { reset: "ok" }) }));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Pattern" }));
    expect(screen.getByText("pattern intro")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agent Gateway (IG)" }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/pattern?path=ig"));
    fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
    expect((await screen.findByTestId("pattern-now")).textContent).toMatch(/say go/);
    expect(screen.getByTestId("pattern-json").textContent).toMatch(/aud/);
    fireEvent.click(screen.getByTestId("pattern-reset"));
    await waitFor(() => expect(screen.queryByTestId("pattern-now")).toBeNull());
  });
});
