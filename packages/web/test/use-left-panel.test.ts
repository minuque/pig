import { describe, expect, it } from "vitest";
import { fitPanelWidth, panelWidthFor } from "../src/app/use-left-panel.js";

describe("left panel width helpers", () => {
  it("clamps desired width to panel bounds", () => {
    expect(panelWidthFor(100, 1280)).toBe(240);
    expect(panelWidthFor(360, 1280)).toBe(360);
    expect(panelWidthFor(600, 1280)).toBe(420);
  });

  it("yields to the main content minimum when the viewport is narrow", () => {
    expect(panelWidthFor(360, 700)).toBe(360); // room = 700 - 332 = 368
    expect(panelWidthFor(300, 500)).toBe(240); // room = 168 → floor at 240
  });

  it("keeps the width when it fits and trims excess otherwise", () => {
    expect(fitPanelWidth(360, 1280)).toBe(360);
    expect(fitPanelWidth(420, 700)).toBe(368);
    expect(fitPanelWidth(300, 500)).toBe(240);
    expect(fitPanelWidth(240, 500)).toBe(240);
  });
});
