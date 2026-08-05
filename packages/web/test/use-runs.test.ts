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

describe("useRuns pre-response events", () => {
  it("replays events that arrive before the run creation response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const envelopes = [
      {
        version: "0.1.0",
        type: "run.queued",
        workspaceId: "workspace",
        sessionId: "session",
        runId: "run",
        data: {},
        sequence: 1,
      },
      {
        version: "0.1.0",
        type: "run.output.delta",
        workspaceId: "workspace",
        sessionId: "session",
        runId: "run",
        data: { text: "hello" },
        sequence: 2,
      },
      {
        version: "0.1.0",
        type: "run.running",
        workspaceId: "workspace",
        sessionId: "session",
        runId: "run",
        data: {},
        sequence: 3,
      },
      {
        version: "0.1.0",
        type: "run.completed",
        workspaceId: "workspace",
        sessionId: "session",
        runId: "run",
        data: {},
        sequence: 4,
      },
    ];
    let resolveCreate!: (value: unknown) => void;
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
        return new Promise((resolve) => {
          resolveCreate = resolve;
        });
      return Promise.resolve({ run: {} });
    });
    streamEvents.mockImplementation(async (onEvent, _signal, onOpen) => {
      onOpen({ gap: false });
      for (const envelope of envelopes) onEvent(envelope);
      return { gap: false, latestSequence: undefined };
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
    const sending = runs.sendPrompt();
    resolveCreate({
      run: {
        id: "run",
        workspaceId: "workspace",
        sessionId: "session",
        status: "queued",
        output: "",
      },
    });
    await sending;

    await vi.waitFor(() => expect(runs.sessionRuns.value).toHaveLength(0));
    expect(loadTranscript).toHaveBeenCalled();
  });
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
