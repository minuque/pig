import { describe, expect, it } from "vitest";
import type { SSEEventEnvelope } from "@no-pi-no-gang/contracts";
import type { UiRun } from "../src/features/runs/run-state.js";
import {
  clampPanelWidth,
  isNearBottom,
  routeSessionEvent,
  sessionState,
} from "../src/features/sessions/session-state.js";

describe("workbench state", () => {
  it("clamps panel widths and detects whether transcript should follow", () => {
    expect(clampPanelWidth(100)).toBe(240);
    expect(clampPanelWidth(340)).toBe(340);
    expect(clampPanelWidth(600)).toBe(420);
    expect(isNearBottom(820, 100, 1000)).toBe(true);
    expect(isNearBottom(700, 100, 1000)).toBe(false);
  });

  it("keeps scroll and follow state isolated by session", () => {
    const states = new Map();
    const first = sessionState(states, "workspace-a", "same");
    first.scrollTop = 320;
    first.following = false;
    first.hasNewActivity = true;

    expect(sessionState(states, "workspace-a", "same")).toBe(first);
    expect(sessionState(states, "workspace-b", "same")).toMatchObject({
      scrollTop: 0,
      following: true,
      hasNewActivity: false,
    });
  });

  it("routes identical session IDs by workspace without cross-state updates", () => {
    const states = new Map();
    const alpha = sessionState(states, "a", "same");
    const beta = sessionState(states, "b", "same");
    const alphaRun: UiRun = {
      id: "run",
      workspaceId: "a",
      sessionId: "same",
      status: "running",
      output: "",
    };
    const betaRun: UiRun = { ...alphaRun, workspaceId: "b", output: "beta" };
    alpha.runs.set(alphaRun.id, alphaRun);
    beta.runs.set(betaRun.id, betaRun);

    routeSessionEvent(states, {
      version: "0.1.0",
      type: "run.output.delta",
      workspaceId: "a",
      sessionId: "same",
      runId: "run",
      data: { text: "alpha" },
    } as SSEEventEnvelope);

    expect(alphaRun.output).toBe("alpha");
    expect(betaRun.output).toBe("beta");
  });
});
