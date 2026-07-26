import type { GatewayEvent, SessionSnapshot } from "@no-pi-no-gang/contracts";
import { QueryClient } from "@tanstack/vue-query";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewaySyncController } from "@/features/sync/gateway-sync-controller";
import { useLiveOverlayStore } from "@/features/sync/live-overlay-store";
import { gatewayKeys } from "@/lib/gateway/keys";
import {
  createMockGatewayClient,
  mockBootstrap,
  mockSessionSnapshot,
} from "@/test-support/mock-client";

const emittedAt = "2025-01-02T03:04:05.000Z";

function delta(seq: number, runSeq: number, text: string): GatewayEvent {
  return {
    schemaVersion: 1,
    contractRevision: 1,
    gatewayEpoch: "epoch_1",
    gatewaySeq: seq,
    emittedAt,
    type: "run.output.delta",
    workspaceId: "workspace_1",
    sessionId: "session_1",
    runId: "run_1",
    runSeq,
    payload: { operation: "append", target: "text", text },
  } as GatewayEvent;
}

async function eventually(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  assertion();
}

describe("GatewaySyncController recovery", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("reduces consecutive coalesced deltas from pending state without loss", async () => {
    const client = createMockGatewayClient();
    vi.mocked(client.events.open).mockImplementation(async function* () {
      yield { kind: "event", event: delta(2, 1, "a") } as const;
      yield { kind: "event", event: delta(3, 2, "b") } as const;
    });
    const store = useLiveOverlayStore();
    store.resetAll("epoch_1:1" as never, []);
    const controller = new GatewaySyncController({
      client,
      queryClient: new QueryClient(),
      store,
      coalesceMs: 5,
    });
    controller.start("epoch_1:1" as never);
    await eventually(() => expect(store.overlay.bySession.session_1?.run_1?.text).toBe("ab"));
    expect(store.overlay.cursor).toBe("epoch_1:3");
    await controller.stop();
  });

  it("stops on a gap and atomically replaces selected Session Query and overlays from snapshots", async () => {
    const client = createMockGatewayClient();
    let opens = 0;
    vi.mocked(client.events.open).mockImplementation((input) => {
      opens += 1;
      if (opens === 1) {
        return (async function* () {
          yield { kind: "event", event: delta(3, 1, "lost") } as const;
        })();
      }
      expect(input.after).toBe("epoch_2:12");
      return (async function* () {})();
    });
    vi.mocked(client.bootstrap.get).mockResolvedValue({
      ...mockBootstrap,
      capturedEventCursor: "epoch_2:10",
      nonterminalRuns: [],
    } as never);
    const replacement: SessionSnapshot = {
      ...mockSessionSnapshot(),
      capturedEventCursor: "epoch_2:12" as never,
      partialOutputs: [
        {
          runId: "run_replacement",
          text: "verified",
          thinking: "",
          tools: [],
        },
      ],
    } as unknown as SessionSnapshot;
    vi.mocked(client.sessions.snapshot).mockResolvedValue(replacement);

    const queryClient = new QueryClient();
    queryClient.setQueryData(
      gatewayKeys.sessions.snapshot("session_1" as never),
      mockSessionSnapshot(),
    );
    const store = useLiveOverlayStore();
    store.resetAll("epoch_1:1" as never, []);
    const controller = new GatewaySyncController({
      client,
      queryClient,
      store,
      coalesceMs: 5,
      resyncDelayMs: 5,
    });
    controller.start("epoch_1:1" as never);

    await eventually(() => expect(opens).toBe(2));
    expect(client.sessions.snapshot).toHaveBeenCalledWith({
      sessionId: "session_1",
    });
    expect(
      queryClient.getQueryData(gatewayKeys.sessions.snapshot("session_1" as never)),
    ).toStrictEqual(replacement);
    expect(store.overlay.cursor).toBe("epoch_2:12");
    expect(store.overlay.bySession.session_1?.run_replacement?.text).toBe("verified");
    expect(store.overlay.bySession.session_1?.run_1).toBeUndefined();
    await controller.stop();
  });

  it("resumes the stream from the newest verified snapshot cursor without re-reducing covered events", async () => {
    const client = createMockGatewayClient();
    let opens = 0;
    vi.mocked(client.events.open).mockImplementation((input) => {
      opens += 1;
      if (opens === 1) {
        return (async function* () {
          yield { kind: "event", event: delta(3, 1, "lost") } as const;
        })();
      }
      // Events between the bootstrap cursor (epoch_1:10) and the snapshot
      // cursor (epoch_1:14) are already covered by the snapshot; the stream
      // must resume strictly after it instead of replaying them.
      expect(input.after).toBe("epoch_1:14");
      return (async function* () {
        yield { kind: "event", event: delta(15, 1, " live") } as const;
      })();
    });
    vi.mocked(client.bootstrap.get).mockResolvedValue({
      ...mockBootstrap,
      capturedEventCursor: "epoch_1:10",
      nonterminalRuns: [],
    } as never);
    const snapshot: SessionSnapshot = {
      ...mockSessionSnapshot(),
      capturedEventCursor: "epoch_1:14" as never,
      partialOutputs: [{ runId: "run_1", text: "covered", thinking: "", tools: [] }],
    } as unknown as SessionSnapshot;
    vi.mocked(client.sessions.snapshot).mockResolvedValue(snapshot);

    const queryClient = new QueryClient();
    queryClient.setQueryData(
      gatewayKeys.sessions.snapshot("session_1" as never),
      mockSessionSnapshot(),
    );
    const store = useLiveOverlayStore();
    store.resetAll("epoch_1:1" as never, []);
    const controller = new GatewaySyncController({
      client,
      queryClient,
      store,
      coalesceMs: 5,
      resyncDelayMs: 5,
    });
    controller.start("epoch_1:1" as never);

    await eventually(() =>
      expect(store.overlay.bySession.session_1?.run_1?.text).toBe("covered live"),
    );
    expect(store.overlay.cursor).toBe("epoch_1:15");
    await controller.stop();
  });

  it("resets recovery on an epoch-divergent snapshot and only installs a consistent re-capture", async () => {
    const client = createMockGatewayClient();
    let opens = 0;
    const resumeCursors: unknown[] = [];
    vi.mocked(client.events.open).mockImplementation((input) => {
      opens += 1;
      if (opens === 1) {
        return (async function* () {
          yield { kind: "event", event: delta(3, 1, "lost") } as const;
        })();
      }
      resumeCursors.push(input.after);
      return (async function* () {})();
    });
    vi.mocked(client.bootstrap.get)
      .mockResolvedValueOnce({
        ...mockBootstrap,
        capturedEventCursor: "epoch_1:10",
        nonterminalRuns: [],
      } as never)
      .mockResolvedValue({
        ...mockBootstrap,
        capturedEventCursor: "epoch_2:20",
        nonterminalRuns: [],
      } as never);
    const mixedSnapshot: SessionSnapshot = {
      ...mockSessionSnapshot(),
      capturedEventCursor: "epoch_2:14" as never,
      partialOutputs: [{ runId: "run_1", text: "mixed", thinking: "", tools: [] }],
    } as unknown as SessionSnapshot;
    const consistentSnapshot: SessionSnapshot = {
      ...mockSessionSnapshot(),
      capturedEventCursor: "epoch_2:22" as never,
      partialOutputs: [{ runId: "run_1", text: "verified", thinking: "", tools: [] }],
    } as unknown as SessionSnapshot;
    vi.mocked(client.sessions.snapshot)
      .mockResolvedValueOnce(mixedSnapshot)
      .mockResolvedValue(consistentSnapshot);

    const queryClient = new QueryClient();
    queryClient.setQueryData(
      gatewayKeys.sessions.snapshot("session_1" as never),
      mockSessionSnapshot(),
    );
    const store = useLiveOverlayStore();
    store.resetAll("epoch_1:1" as never, []);
    const controller = new GatewaySyncController({
      client,
      queryClient,
      store,
      coalesceMs: 5,
      resyncDelayMs: 5,
    });
    controller.start("epoch_1:1" as never);

    await eventually(() => expect(store.overlay.bySession.session_1?.run_1?.text).toBe("verified"));
    // The mixed-epoch capture was discarded wholesale, never committed.
    expect(client.bootstrap.get).toHaveBeenCalledTimes(2);
    expect(resumeCursors).toEqual(["epoch_2:22"]);
    expect(store.overlay.cursor).toBe("epoch_2:22");
    expect(
      queryClient.getQueryData(gatewayKeys.sessions.snapshot("session_1" as never)),
    ).toStrictEqual(consistentSnapshot);
    await controller.stop();
  });
});
