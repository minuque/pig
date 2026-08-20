import { describe, expect, it } from "vitest";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { modelFromBranch } from "../src/pi/session-card.js";

function modelChange(provider: string, modelId: string): SessionEntry {
  return {
    type: "model_change",
    id: modelId,
    parentId: null,
    timestamp: "1",
    provider,
    modelId,
  };
}

describe("modelFromBranch", () => {
  it("returns the last model_change on the branch", () => {
    expect(modelFromBranch([])).toBeUndefined();
    expect(
      modelFromBranch([
        modelChange("openai", "gpt-4"),
        { type: "session_info", id: "n", parentId: null, timestamp: "1", name: "x" },
        modelChange("openai", "o3"),
      ]),
    ).toEqual({ provider: "openai", id: "o3" });
  });
});
