import { describe, expect, it } from "vitest";
import { transcriptMeasurementKey } from "@features/session-workbench/transcript-layout.js";

describe("transcriptMeasurementKey", () => {
  it("binds layout identity, not a Session id", () => {
    expect(transcriptMeasurementKey(720.4, "dark")).toBe("720:dark:doc-v3");
    expect(transcriptMeasurementKey(720, "light")).toBe("720:light:doc-v3");
  });

  it("treats non-finite width as 0", () => {
    expect(transcriptMeasurementKey(Number.NaN, "light")).toBe("0:light:doc-v3");
  });
});
