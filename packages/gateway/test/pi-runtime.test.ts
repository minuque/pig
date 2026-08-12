import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { CommandId, RunId, Workspace } from "@pig/contracts";
import { describe, expect, it, vi } from "vitest";
import { PiRuntimeAdapterImpl } from "../src/index.js";

const workspace = (path: string, id = "workspace") =>
  ({
    id,
    canonicalPath: path,
    name: id,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as Workspace;

describe("PiRuntimeAdapterImpl", () => {
  it("uses authenticated models, unambiguous profile keys, and Pi thinking levels without network", async () => {
    const models = [
      {
        provider: "provider-a",
        id: "same-model",
        name: "Same Model",
        reasoning: true,
        contextWindow: 1000,
      },
      {
        provider: "provider-b",
        id: "same-model",
        name: "Same Model",
        reasoning: false,
        contextWindow: 1000,
      },
    ];
    const disposed: string[] = [];
    const runtime = {
      async getAvailable() {
        return models;
      },
      getProvider: (id: string) => ({
        id,
        name: id === "provider-a" ? "Provider A" : "Provider B",
      }),
    };
    const adapter = new PiRuntimeAdapterImpl(async () => runtime as never, (async ({
      model,
    }: {
      model: (typeof models)[number];
    }) => ({
      session: {
        getAvailableThinkingLevels: () =>
          model.provider === "provider-a" ? ["off", "high"] : ["low"],
        dispose: () => disposed.push(model.provider),
      },
    })) as never);

    expect(await adapter.capabilities()).toEqual({
      presets: [
        { model: "provider-a/same-model", thinkingLevel: "off" },
        { model: "provider-a/same-model", thinkingLevel: "high" },
        { model: "provider-b/same-model", thinkingLevel: "low" },
      ],
      catalog: [
        {
          id: "provider-a",
          name: "Provider A",
          models: [
            {
              id: "same-model",
              name: "Same Model",
              reasoning: true,
              thinkingLevels: ["off", "high"],
              contextWindow: 1000,
              brand: "Provider A",
              description: "Same Model",
            },
          ],
        },
        {
          id: "provider-b",
          name: "Provider B",
          models: [
            {
              id: "same-model",
              name: "Same Model",
              reasoning: false,
              thinkingLevels: ["low"],
              contextWindow: 1000,
              brand: "Provider B",
              description: "Same Model",
            },
          ],
        },
      ],
    });
    expect(disposed).toEqual(["provider-a", "provider-b"]);
  });

  it("persists a native Pi session immediately and supports discover/read/open lifecycle", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pi-runtime-"));
    try {
      const adapter = new PiRuntimeAdapterImpl(undefined, undefined, join(directory, "sessions"));
      const current = await adapter.startSession(workspace(directory), "Native");
      const discovered = await adapter.discoverSessions(workspace(directory));
      expect(discovered).toMatchObject([{ id: current.id, name: "Native" }]);
      const path = (await SessionManager.list(directory, join(directory, "sessions")))[0]!.path;
      expect(SessionManager.open(path).getSessionId()).toBe(current.id);
      expect(await adapter.readTranscript(workspace(directory), current.id)).toMatchObject([
        { type: "session_info", name: "Native" },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps identical Pi session IDs isolated by workspace path and transcript", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pi-runtime-collision-"));
    const id = "11111111-1111-4111-8111-111111111111";
    try {
      for (const [workspaceId, name] of [
        ["a", "Alpha"],
        ["b", "Beta"],
      ] as const) {
        const manager = SessionManager.create(directory, join(directory, workspaceId), { id });
        manager.appendSessionInfo(name);
        await writeFile(
          manager.getSessionFile()!,
          `${[manager.getHeader(), ...manager.getEntries()]
            .map((entry) => JSON.stringify(entry))
            .join("\n")}\n`,
          { flag: "wx" },
        );
      }
      const adapter = new PiRuntimeAdapterImpl(undefined, undefined, (current) =>
        join(directory, current.id),
      );
      const alpha = workspace(directory, "a");
      const beta = workspace(directory, "b");
      await adapter.discoverSessions(alpha);
      await adapter.discoverSessions(beta);
      expect(await adapter.readTranscript(alpha, id as never)).toMatchObject([
        { type: "session_info", name: "Alpha" },
      ]);
      expect(await adapter.readTranscript(beta, id as never)).toMatchObject([
        { type: "session_info", name: "Beta" },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("registers pending factories before await so immediate cancel and steer reach the session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pi-runtime-pending-"));
    try {
      const resolvers: Array<(value: unknown) => void> = [];
      const sessions: Array<{
        abort: ReturnType<typeof vi.fn>;
        steer: ReturnType<typeof vi.fn>;
        prompt: ReturnType<typeof vi.fn>;
      }> = [];
      const factory = () =>
        new Promise((resolve) => {
          const session = {
            abort: vi.fn(async () => undefined),
            steer: vi.fn(async () => undefined),
            prompt: vi.fn(async () => undefined),
            subscribe: () => () => undefined,
            dispose: () => undefined,
          };
          sessions.push(session);
          resolvers.push(() => resolve({ session }));
        });
      const runtime = {
        getModel: () => ({}),
        async getAvailable() {
          return [];
        },
      };
      const adapter = new PiRuntimeAdapterImpl(
        async () => runtime as never,
        factory as never,
        join(directory, "sessions"),
      );
      const current = await adapter.startSession(workspace(directory));
      const profile = { model: "fake/model", thinkingLevel: "off" };

      const cancelledRun = adapter.createRun(
        workspace(directory).id,
        current.id,
        "do not prompt",
        "cancelled" as CommandId,
        undefined,
        profile,
      );
      const cancel = adapter.cancelRun("cancelled" as RunId);
      await vi.waitFor(() => expect(resolvers).toHaveLength(1));
      resolvers.shift()!({});
      await cancel;
      expect(await cancelledRun).toMatchObject({ status: "cancelled" });
      expect(sessions[0]!.abort).toHaveBeenCalledOnce();
      expect(sessions[0]!.prompt).not.toHaveBeenCalled();

      const steeredRun = adapter.createRun(
        workspace(directory).id,
        current.id,
        "prompt",
        "steered" as CommandId,
        undefined,
        profile,
      );
      const steer = adapter.steerRun("steered" as RunId, "correction");
      await vi.waitFor(() => expect(resolvers).toHaveLength(1));
      resolvers.shift()!({});
      await steer;
      await steeredRun;
      expect(sessions[1]!.steer).toHaveBeenCalledWith("correction");
      expect(sessions[1]!.prompt).toHaveBeenCalledWith("prompt");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
