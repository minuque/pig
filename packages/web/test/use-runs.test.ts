import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

const { api, streamEvents } = vi.hoisted(() => ({ api: vi.fn(), streamEvents: vi.fn() }));
vi.mock("../src/api/index.js", () => ({
  api,
  streamEvents,
  errorMessage: () => "error",
}));

import type { SessionDto, WorkspaceDto } from "../src/api/index.js";
import { useRuns } from "../src/features/runs/use-runs.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useRuns event recovery", () => {
  it("reconnects after a disconnect, reloads transcript, and refreshes a queued run", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    api.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/capabilities")
        return Promise.resolve({
          presets: [{ model: "fake/model", thinkingLevel: "off" }],
          catalog: [
            {
              id: "fake",
              name: "Fake",
              models: [{ id: "model", name: "Model", reasoning: false, thinkingLevels: ["off"] }],
            },
          ],
        });
      if (init?.method === "POST")
        return Promise.resolve({
          run: {
            id: "run",
            workspaceId: "workspace",
            sessionId: "session",
            status: "queued",
          },
        });
      return Promise.resolve({
        run: {
          id: "run",
          workspaceId: "workspace",
          sessionId: "session",
          status: "completed",
          output: "done",
        },
      });
    });
    vi.useFakeTimers();
    streamEvents.mockClear();
    streamEvents
      .mockImplementationOnce(async (_onEvent, _signal, onOpen) => {
        onOpen();
        return { gap: false, latestSequence: undefined };
      })
      .mockImplementationOnce(async (_onEvent, _signal, onOpen) => {
        onOpen();
        return { gap: true, latestSequence: undefined };
      });
    const loadTranscript = vi.fn(async () => undefined);
    const workspace = ref<WorkspaceDto>({
      id: "workspace",
      name: "Workspace",
      canonicalPath: "/workspace",
    });
    const session = ref<SessionDto>({
      id: "session",
      workspaceId: "workspace",
      status: "available",
      updatedAt: "now",
    });
    const runs = useRuns(
      workspace,
      computed(() => session.value),
      loadTranscript,
    );

    await runs.startEvents();
    runs.prompt.value = "prompt";
    await runs.sendPrompt();
    await vi.advanceTimersByTimeAsync(100);
    await vi.waitFor(() => expect(loadTranscript).toHaveBeenCalledOnce());

    expect(streamEvents).toHaveBeenCalledTimes(2);
    expect(runs.sessionRuns.value[0]?.status).toBe("completed");
  });
});
