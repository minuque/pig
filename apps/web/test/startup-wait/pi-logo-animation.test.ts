import { describe, expect, it } from "vitest";
import {
  PI_LOGO_DURATION_MS,
  PI_LOGO_FRAMES,
  cellsForPiLogoFrame,
} from "@features/startup-wait/index.vue";

describe("Pi startup logo animation", () => {
  it("matches the current install.ps1 frame order and 2.63 second duration", () => {
    expect(PI_LOGO_FRAMES).toHaveLength(21);
    expect(PI_LOGO_DURATION_MS).toBe(2630);
    expect(PI_LOGO_FRAMES.slice(0, 4).map((frame) => [frame.active, frame.activeY])).toEqual([
      ["left", 0],
      ["left", 1],
      ["left", 2],
      ["left", 3],
    ]);
    expect(PI_LOGO_FRAMES.slice(4, 7).map((frame) => frame.active)).toEqual(["top", "top", "top"]);
    expect(PI_LOGO_FRAMES.slice(7, 12).map((frame) => frame.active)).toEqual([
      "right",
      "right",
      "right",
      "right",
      "right",
    ]);
    expect(PI_LOGO_FRAMES.at(-1)).toMatchObject({ phase: 5, durationMs: 450, theme: true });
  });

  it("clears the six-cell row and settles into the ten-cell Pi mark", () => {
    const flashRow = cellsForPiLogoFrame(PI_LOGO_FRAMES[13]!).filter((cell) => cell.y === 6);
    expect(flashRow).toEqual([1, 2, 3, 4, 5, 6].map((x) => ({ x, y: 6, color: "orange" })));

    const finalCells = cellsForPiLogoFrame(PI_LOGO_FRAMES.at(-1)!);
    expect(finalCells.map(({ x, y }) => `${y},${x}`)).toEqual([
      "3,2",
      "3,3",
      "3,4",
      "4,2",
      "4,4",
      "5,2",
      "5,3",
      "5,5",
      "6,2",
      "6,5",
    ]);
    expect(finalCells.every((cell) => cell.color === "theme")).toBe(true);
  });
});
