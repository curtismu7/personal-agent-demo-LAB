import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App.jsx";

// The header shows this lab's own Verified / In progress mark, read from the same /api/shelf call the Shelf link makes (through the lab-proxy
// that call reaches the shelf, whose payload lists every demo with its mark). The lab's own /api/shelf has no demos, so there is no mark then.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const FLOW = {
  title: "How an AI assistant reaches Test Air's member benefits",
  intro: "intro text",
  source: "sequenceDiagram\n    autonumber\n    participant A as Agent\\nx\n    participant B as Door\\ny\n    A->>B: first message\n    B-->>A: second message",
  payloads: ["a: 1", null],
  details: { A: "agent detail", B: "door detail" },
  hops: [{ n: 1, title: "Discover", first: 0, last: 1, say: "say one" }],
};
const mark = (status, label, extra = {}) => ({ status, label, note: "", updatedAt: "2026-11-15", source: "shipped", ...extra });
function stubFetch(shelf) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const u = String(url);
    if (u.endsWith("/api/shelf")) return { ok: true, json: async () => shelf };
    if (u.endsWith("/api/flow")) return { ok: true, json: async () => FLOW };
    if (u.endsWith("/api/info")) return { ok: true, json: async () => ({ mode: "mock", simulated: true, hosted: false, source: "mock", realAvailable: false }) };
    return { ok: true, json: async () => ({}) };
  });
}

describe("verification mark in the header", () => {
  it("shows this lab's own mark beside the Shelf link, and no other lab's", async () => {
    stubFetch({ shelfUrl: "http://shelf.example", demos: [
      { id: "other-lab", verification: mark("in-progress", "In progress") },
      { id: "personal-agent-demo", verification: mark("verified", "Verified", { note: "Walked the twelve steps on the mock" }) },
    ] });
    render(<App />);
    const bar = within(await screen.findByTestId("top-menu"));
    expect(await bar.findByText("Verified")).toBeInTheDocument();
    expect(bar.getAllByText("Verified")).toHaveLength(1);
    expect(document.querySelectorAll(".verify")).toHaveLength(1);
    expect(document.querySelector("a.shelf-link")).not.toBeNull(); // the lab's ShelfLink (TopMenu also draws its own Shelf link: pre-existing)
    expect(bar.queryByText("In progress")).toBeNull();
    expect(bar.getByText("Verified").closest(".verify")).toHaveAttribute("title", expect.stringContaining("Walked the twelve steps on the mock"));
  });

  it("shows nothing when the lab is opened on its own port (its /api/shelf has no demos) or the shelf has no mark for it", async () => {
    for (const payload of [{ shelfUrl: "http://shelf.example" }, { shelfUrl: "http://shelf.example", demos: [{ id: "personal-agent-demo", verification: null }] }]) {
      stubFetch(payload);
      const { unmount } = render(<App />);
      await screen.findByTestId("top-menu");
      await waitFor(() => expect(document.querySelector("a.shelf-link")).not.toBeNull()); // the shelf answered, and still no badge
      expect(document.querySelector(".verify")).toBeNull();
      unmount();
      vi.restoreAllMocks();
    }
  });
});
