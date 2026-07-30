import { describe, expect, it } from "vitest";
import type { SSEEventEnvelope } from "@no-pi-no-gang/contracts";
import { routeRunEvent, type UiRun } from "./run-state.js";

function event(type: string, sessionId: string, runId: string, data: unknown = {}) {
  return { version: "0.1.0", type, sessionId, runId, data } as SSEEventEnvelope;
}

describe("routeRunEvent", () => {
  it("routes deltas only to matching stable session and run IDs", () => {
    const first: UiRun = {
      id: "r1",
      workspaceId: "w",
      sessionId: "s1",
      status: "running",
      output: "",
    };
    const second: UiRun = {
      id: "r2",
      workspaceId: "w",
      sessionId: "s2",
      status: "running",
      output: "",
    };
    const runs = new Map([
      [first.id, first],
      [second.id, second],
    ]);

    routeRunEvent(runs, event("run.output.delta", "s2", "r2", { text: "safe" }));
    routeRunEvent(runs, event("run.output.delta", "s1", "r2", { text: "wrong" }));

    expect(first.output).toBe("");
    expect(second.output).toBe("safe");
  });

  it("returns the matching run at terminal state so the caller can reload durable transcript", () => {
    const run: UiRun = {
      id: "r",
      workspaceId: "w",
      sessionId: "s",
      status: "running",
      output: "partial",
    };
    const settled = routeRunEvent(new Map([[run.id, run]]), event("run.completed", "s", "r"));

    expect(settled).toBe(run);
    expect(run.status).toBe("completed");
    expect(
      routeRunEvent(
        new Map([[run.id, run]]),
        event("run.output.delta", "s", "r", { text: "late" }),
      ),
    ).toBeUndefined();
    expect(run.output).toBe("partial");
  });
});
