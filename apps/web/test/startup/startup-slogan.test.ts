import { describe, expect, it } from "vitest";
import {
  STARTUP_SLOGAN,
  STARTUP_SLOGAN_LINES,
  typedSlogan,
} from "@features/startup/components/StartupOverlay.vue";

describe("startup slogan typing", () => {
  it("keeps the two-line tagline with yours as the closing word", () => {
    expect(STARTUP_SLOGAN_LINES).toEqual([
      "There are many agent harnesses",
      "but this one is yours",
    ]);
    expect(STARTUP_SLOGAN).toBe("There are many agent harnesses\nbut this one is yours");
    expect(STARTUP_SLOGAN.endsWith("yours")).toBe(true);
  });

  it("types the first line before moving the caret to the second", () => {
    expect(typedSlogan(0)).toEqual({
      lines: [
        { plain: "", highlight: "" },
        { plain: "", highlight: "" },
      ],
      cursorLine: 0,
    });
    expect(typedSlogan(11)).toEqual({
      lines: [
        { plain: "There are m", highlight: "" },
        { plain: "", highlight: "" },
      ],
      cursorLine: 0,
    });
    expect(typedSlogan(30)).toEqual({
      lines: [
        { plain: "There are many agent harnesses", highlight: "" },
        { plain: "", highlight: "" },
      ],
      cursorLine: 0,
    });
    expect(typedSlogan(31)).toEqual({
      lines: [
        { plain: "There are many agent harnesses", highlight: "" },
        { plain: "", highlight: "" },
      ],
      cursorLine: 1,
    });
  });

  it("highlights yours only after that word starts appearing", () => {
    expect(typedSlogan(47)).toEqual({
      lines: [
        { plain: "There are many agent harnesses", highlight: "" },
        { plain: "but this one is ", highlight: "" },
      ],
      cursorLine: 1,
    });
    expect(typedSlogan(48)).toEqual({
      lines: [
        { plain: "There are many agent harnesses", highlight: "" },
        { plain: "but this one is ", highlight: "y" },
      ],
      cursorLine: 1,
    });
    expect(typedSlogan(STARTUP_SLOGAN.length)).toEqual({
      lines: [
        { plain: "There are many agent harnesses", highlight: "" },
        { plain: "but this one is ", highlight: "yours" },
      ],
      cursorLine: 1,
    });
  });
});
