import { describe, expect, it } from "vitest";
import {
  BASE,
  CLEAR_ROW,
  FINAL_LOGO,
  LEFT,
  LOGO_SEQUENCE,
  RIGHT,
  TOP,
  assembleSettled,
  cellKeys,
  cellsExceptRow,
  composeCells,
  dropAfterClear,
  easeOutCubic,
  piecePosition,
  themeLogoCells,
  toCellKey,
} from "@features/startup/lib/pi-logo-animation.js";

describe("Pi startup logo animation", () => {
  it("drops base, left, top, then right onto the 8×9 board", () => {
    expect(LOGO_SEQUENCE.map((step) => step.piece)).toEqual([BASE, LEFT, TOP, RIGHT]);
    expect(BASE.targetY).toBe(CLEAR_ROW);
    expect(LEFT.targetX).toBe(2);
    expect(TOP.targetY).toBe(2);
    expect(RIGHT.targetX).toBe(5);
  });

  it("eases a piece from spawn to its target cell", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(piecePosition(BASE, 0)).toEqual({ x: BASE.startX, y: BASE.startY });
    expect(piecePosition(BASE, 1)).toEqual({ x: BASE.targetX, y: BASE.targetY });
    expect(piecePosition(LEFT, 0, 8).y).toBe(-9);
  });

  it("clears row 6 and settles into the ten-cell Pi mark", () => {
    const settled = assembleSettled();
    const flash = composeCells(settled, null, { flashClearRow: true });
    expect(
      Object.entries(flash)
        .filter(([, color]) => color === "flash")
        .map(([position]) => position)
        .sort(),
    ).toEqual([1, 2, 3, 4, 5, 6].map((x) => toCellKey(CLEAR_ROW, x)));

    const floating = cellsExceptRow(settled, CLEAR_ROW, "theme");
    expect(Object.values(floating).every((color) => color === "theme")).toBe(true);
    expect(cellKeys(floating).some((key) => key.startsWith(`${CLEAR_ROW}:`))).toBe(false);

    const dropped = dropAfterClear(settled, "theme");
    expect(cellKeys(dropped)).toEqual([...FINAL_LOGO]);
    expect(cellKeys(themeLogoCells())).toEqual([...FINAL_LOGO]);
  });
});
