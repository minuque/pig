import { describe, expect, it } from "vitest";
import {
  StableClock,
  SequenceIdSource,
  buildRun,
  buildSession,
} from "./index.js";

describe("deterministic test dependencies", () => {
  it("advances a stable clock only when instructed", () => {
    const clock = new StableClock("2025-01-02T03:04:05.000Z");
    expect(clock.now()).toBe("2025-01-02T03:04:05.000Z");
    expect(clock.advance(250)).toBe("2025-01-02T03:04:05.250Z");
    expect(clock.now()).toBe("2025-01-02T03:04:05.250Z");
  });

  it("builds stable IDs and valid public fixtures", () => {
    const ids = new SequenceIdSource(7);
    expect([ids.next("run"), ids.next("run")]).toEqual(["run_7", "run_8"]);
    expect(buildSession({ name: "Resume me" }).name).toBe("Resume me");
    expect(buildRun({ state: "interrupted" }).state).toBe("interrupted");
  });
});
