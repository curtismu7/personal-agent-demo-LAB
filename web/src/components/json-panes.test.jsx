import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DiagramReel from "./DiagramReel";
import SequenceFlowDiagram, { buildSequenceFlow } from "./SequenceFlowDiagram";
import { setJsonView } from "./JsonPane.jsx";
import { HOT_KEYS, splitPayload } from "../utils/payload";
import { withStepDetail } from "../utils/diagramReel";

// Rule 24: every place this lab shows JSON goes through the shared JsonPane (Form | JSON, full view). The Form | JSON choice is shared module state.
beforeEach(() => setJsonView("form"));
afterEach(cleanup);

const BODY = '{\n  "decision": "Permit",\n  "tool": "get_my_benefits"\n}';
const TITLED = `Policy decision (MOCK: teaching values, not a credential)\n${BODY}`;

describe("splitPayload", () => {
  it("splits a title line from a JSON body and keeps the body exactly as given", () => {
    expect(splitPayload(TITLED)).toEqual({ title: "Policy decision (MOCK: teaching values, not a credential)", json: BODY });
  });
  it("takes a bare JSON string whole, and leaves wire text alone", () => {
    expect(splitPayload(BODY)).toEqual({ title: "", json: BODY });
    expect(splitPayload("POST https://mcp.example/mcp\ntool: get_my_benefits").json).toBeNull();
    expect(splitPayload("HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer").json).toBeNull();
    expect(splitPayload(null).json).toBeNull();
  });
});

describe("the movie reel details row", () => {
  const stepper = { step: 0, goTo() {} };
  const steps = (lines) => [{ n: 1, title: "A → B", label: "go", lines }];

  it("shows a JSON line as a pane with a Form | JSON toggle, and the JSON view is the exact text", () => {
    render(<DiagramReel steps={steps([{ who: "Payload", label: "Policy decision", json: BODY }])} stepper={stepper} openKey={1} />);
    const detail = screen.getByTestId("diagram-reel-detail");
    expect(detail.querySelector(".jsonbox")).not.toBeNull();
    expect([...detail.querySelectorAll(".jsonbox__toggle button")].map((b) => b.textContent)).toEqual(["Form", "JSON"]);
    expect(detail.textContent).toMatch(/Policy decision/);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(detail.querySelector("pre.json--raw").textContent).toBe(BODY);
    // the lab's own keys are stood out, and nothing here is a scroll box
    expect(HOT_KEYS).toContain("tool");
    expect(detail.querySelectorAll(".jtok--hot").length).toBeGreaterThan(0);
    expect(detail.querySelector("[style*='max-height'], [style*='overflow']")).toBeNull();
  });

  it("keeps wire text (a request form) as plain text, not a JSON pane", () => {
    render(<DiagramReel steps={steps([{ who: "Request", code: "POST https://mcp.example/mcp\ntool: get_my_benefits" }])} stepper={stepper} openKey={1} />);
    const detail = screen.getByTestId("diagram-reel-detail");
    expect(detail.querySelector(".jsonbox")).toBeNull();
    expect(detail.querySelector("pre.dreel-code").textContent).toMatch(/^POST /);
  });

  it("withStepDetail hands a decoded token to the pane as an object", () => {
    const folded = withStepDetail(
      [{ n: 1, lines: [] }],
      [{ edges: [0], detail: { form: "grant_type=x", tokens: [{ note: "Access token · aud one", header: { alg: "RS256" }, claims: { sub: "u", aud: "a" } }] } }],
    );
    const [request, token] = folded[0].lines;
    expect(request).toEqual({ who: "Request", code: "grant_type=x" });
    expect(token.json).toEqual({ header: { alg: "RS256" }, claims: { sub: "u", aud: "a" } });
    expect(token.label).toMatch(/Access token/);
  });
});

describe("the payload boxes in the sequence diagram", () => {
  const SOURCE = "sequenceDiagram\n    autonumber\n    participant A as Agent\n    participant B as Door\n    A->>B: first\n    B-->>A: second\n    A->>B: third";
  const PAYLOADS = [TITLED, "POST https://mcp.example/mcp", null];
  const rowOf = (flow, id) => flow.nodes.find((n) => n.id === id).position.y;

  it("a JSON payload box makes room for its measured height; wire text keeps its line-count height", () => {
    const at = (heights, id) => rowOf(buildSequenceFlow(SOURCE, PAYLOADS, heights), id);
    // the box starts where it did; the next message moves down by exactly the extra measured height
    expect(at({ 0: 500 }, "pl0")).toBe(at({ 0: 300 }, "pl0"));
    expect(at({ 0: 500 }, "a1s") - at({ 0: 300 }, "a1s")).toBe(200);
    // a measured height is ignored for a wire-text payload
    expect(at({ 1: 900 }, "a2s")).toBe(at({}, "a2s"));
  });

  it("renders a JSON payload through the pane (title above it, toggle Form | JSON) and wire text as a pre", () => {
    render(<SequenceFlowDiagram source={SOURCE} payloads={PAYLOADS} driver={{ step: -1, goTo() {} }} />);
    const canvas = screen.getByTestId("sequence-flow-canvas");
    const box = canvas.querySelector(".sfx-payload--json");
    expect(box).not.toBeNull();
    expect(box.querySelector(".jsonbox")).not.toBeNull();
    expect(box.textContent).toMatch(/Policy decision/);
    expect([...box.querySelectorAll(".jsonbox__toggle button")].map((b) => b.textContent)).toEqual(["Form", "JSON"]);
    expect(canvas.querySelector("pre.sfx-payload").textContent).toMatch(/^POST /);
  });
});
