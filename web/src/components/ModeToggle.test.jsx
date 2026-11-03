import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ModeToggle from "./ModeToggle.jsx";

afterEach(cleanup);

describe("ModeToggle (rule 19)", () => {
  it("mock only: Mock is pressed and Real is disabled with the reason", () => {
    render(<ModeToggle info={{ source: "mock", realAvailable: false }} onSelect={() => {}} />);
    expect(screen.getByTestId("mode-mock")).toHaveAttribute("aria-pressed", "true");
    const real = screen.getByTestId("mode-real");
    expect(real).toBeDisabled();
    expect(real.getAttribute("title")).toMatch(/mock mode only/i);
  });

  it("before the server answers both buttons are disabled", () => {
    render(<ModeToggle info={null} onSelect={() => {}} />);
    expect(screen.getByTestId("mode-mock")).toBeDisabled();
    expect(screen.getByTestId("mode-real")).toBeDisabled();
  });

  it("clicking the pressed Mock is a no-op; a different mode calls onSelect", async () => {
    const onSelect = vi.fn();
    const { unmount } = render(<ModeToggle info={{ source: "mock", realAvailable: false }} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("mode-mock"));
    expect(onSelect).not.toHaveBeenCalled();
    unmount();
    render(<ModeToggle info={{ source: "real", realAvailable: true }} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("mode-mock"));
    expect(onSelect).toHaveBeenCalledWith("mock");
  });
});
