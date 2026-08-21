import { describe, expect, it } from "vitest";
import {
  SLOGAN_CHAR_MS,
  SLOGAN_GLYPHS,
  SLOGAN_HIGHLIGHT,
  SLOGAN_NEWLINE_MS,
  SLOGAN_SPACE_EXTRA_MS,
  SLOGAN_YOURS_MS,
  STARTUP_SLOGAN,
  STARTUP_SLOGAN_LINES,
  sloganCursorLine,
} from "@features/startup/components/StartupOverlay.vue";

describe("startup slogan typing", () => {
  it("keeps the two-line tagline with yours as the closing word", () => {
    expect(STARTUP_SLOGAN_LINES).toEqual([
      "There are many agent harnesses",
      "but this one is yours",
    ]);
    expect(STARTUP_SLOGAN).toBe("There are many agent harnesses\nbut this one is yours");
    expect(SLOGAN_GLYPHS.map((glyph) => glyph.text).join("")).toBe(
      STARTUP_SLOGAN.replaceAll("\n", ""),
    );
    expect(SLOGAN_GLYPHS.slice(-SLOGAN_HIGHLIGHT.length).every((glyph) => glyph.highlight)).toBe(
      true,
    );
  });

  it("types the first line before moving the caret to the second", () => {
    const firstLine2 = SLOGAN_GLYPHS.find((glyph) => glyph.line === 1);
    expect(SLOGAN_GLYPHS.filter((glyph) => glyph.line === 0)).toHaveLength(30);
    expect(firstLine2).toBeDefined();
    expect(SLOGAN_GLYPHS[0]?.delayMs).toBe(0);
    expect(sloganCursorLine(0)).toBe(0);
    expect(sloganCursorLine(firstLine2!.delayMs - SLOGAN_NEWLINE_MS - 1)).toBe(0);
    expect(sloganCursorLine(firstLine2!.delayMs - SLOGAN_NEWLINE_MS)).toBe(1);
  });

  it("pauses on spaces and newlines, and slows down on yours", () => {
    const firstLine2 = SLOGAN_GLYPHS.find((glyph) => glyph.line === 1)!;
    const lastLine1 = SLOGAN_GLYPHS.filter((glyph) => glyph.line === 0).at(-1)!;
    expect(firstLine2.delayMs - lastLine1.delayMs).toBe(SLOGAN_CHAR_MS + SLOGAN_NEWLINE_MS);

    const tee = SLOGAN_GLYPHS[0]!;
    const afterTee = SLOGAN_GLYPHS[1]!;
    const space = SLOGAN_GLYPHS.find((glyph) => glyph.text === " ")!;
    const afterSpace = SLOGAN_GLYPHS[SLOGAN_GLYPHS.indexOf(space) + 1]!;
    const yours = SLOGAN_GLYPHS.filter((glyph) => glyph.highlight);
    expect(afterTee.delayMs - tee.delayMs).toBe(SLOGAN_CHAR_MS);
    expect(afterSpace.delayMs - space.delayMs).toBe(SLOGAN_CHAR_MS + SLOGAN_SPACE_EXTRA_MS);
    expect(yours[1]!.delayMs - yours[0]!.delayMs).toBe(SLOGAN_YOURS_MS);
    expect(SLOGAN_YOURS_MS).toBeGreaterThan(SLOGAN_CHAR_MS);
  });
});
