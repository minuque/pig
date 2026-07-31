import { describe, expect, it } from "vitest";
import type { SSEEventEnvelope } from "@no-pi-no-gang/contracts";
import {
  queuePreResponseEvent,
  routeRunEvent,
  type UiRun,
} from "../src/features/runs/run-state.js";

function event(
  type: string,
  sessionId: string,
  runId: string,
  data: unknown = {},
  workspaceId = "w",
) {
  return { version: "0.1.0", type, workspaceId, sessionId, runId, data } as SSEEventEnvelope;
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
    routeRunEvent(runs, event("run.output.delta", "s2", "r2", { text: "wrong" }, "other"));

    expect(first.output).toBe("");
    expect(second.output).toBe("safe");
  });

  it("keeps lifecycle events after more than 50 pre-response deltas", () => {
    const queue: SSEEventEnvelope[] = [];
    for (let index = 0; index < 60; index++)
      queuePreResponseEvent(queue, event("run.output.delta", "s", "r", { text: `${index}` }));
    queuePreResponseEvent(queue, event("run.completed", "s", "r"));

    expect(queue).toHaveLength(51);
    expect(queue.at(-1)?.type).toBe("run.completed");
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
