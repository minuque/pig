import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type CapabilityAdapter, CapabilityCoordinator } from "../src/capabilities.js";
import { openStore, removeTempDir, tempDir } from "./helpers.js";

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

const status = {
  providerId: "provider_1",
  revision: 1,
  state: "required" as const,
  methods: ["authFlow" as const],
};

async function eventually<T>(read: () => T | undefined): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("timed out");
}

describe("capability coordination", () => {
  it("keeps secret responses out of SQLite and interrupts pending flows on restart", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const database = join(dir, "app.sqlite3");
    const { db, store } = await openStore(database);
    const canary = "credential-canary-never-persist";
    let received: string | undefined;
    const adapter: CapabilityAdapter = {
      async models() {
        return [];
      },
      async providerAuth() {
        return [status];
      },
      async setApiKey() {
        return status;
      },
      async deleteCredential() {
        return status;
      },
      async login(_providerId, interaction) {
        received = await interaction.prompt({
          type: "secret",
          message: "Credential",
        });
      },
    };
    try {
      const coordinator = new CapabilityCoordinator(store, Promise.resolve(adapter));
      const flow = await coordinator.create("principal_1", "provider_1");
      const prompt = await eventually(() => {
        const current = coordinator.get("principal_1", flow.flowId);
        return current.interaction?.kind === "prompt" ? current.interaction : undefined;
      });
      expect(prompt).toMatchObject({ sensitive: true });
      expect(JSON.stringify(prompt)).not.toContain(canary);
      coordinator.respond("principal_1", flow.flowId, String(prompt.promptId), canary);
      await eventually(() =>
        coordinator.get("principal_1", flow.flowId).state === "succeeded" ? true : undefined,
      );
      expect(received).toBe(canary);
      expect((await readFile(database)).includes(Buffer.from(canary))).toBe(false);

      const pending = await new CapabilityCoordinator(
        store,
        Promise.resolve({
          ...adapter,
          login: async () => new Promise<void>(() => {}),
        }),
      ).create("principal_1", "provider_1");
      new CapabilityCoordinator(store, Promise.resolve(adapter));
      expect(
        store.row<{ state: string }>("SELECT state FROM auth_flows WHERE flow_id=?", pending.flowId)
          ?.state,
      ).toBe("interrupted");
    } finally {
      db.close();
    }
  });

  it("admits only an available model and one of its thinking levels from one snapshot", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    let reads = 0;
    const adapter: CapabilityAdapter = {
      async models() {
        reads += 1;
        return [
          {
            modelId: "model_1",
            providerId: "provider_1",
            name: "Model",
            available: true,
            thinkingLevels: ["off", "high"],
          },
        ];
      },
      async providerAuth() {
        return [];
      },
      async setApiKey() {
        return status;
      },
      async deleteCredential() {
        return status;
      },
      async login() {},
    };
    try {
      const coordinator = new CapabilityCoordinator(store, Promise.resolve(adapter));
      await coordinator.validateExecutionProfile({
        modelId: "model_1",
        thinkingLevel: "high",
      });
      expect(reads).toBe(1);
      await expect(
        coordinator.validateExecutionProfile({
          modelId: "model_1",
          thinkingLevel: "max",
        }),
      ).rejects.toThrow("model.thinking_unsupported");
      await expect(
        coordinator.validateExecutionProfile({
          modelId: "missing",
          thinkingLevel: "off",
        }),
      ).rejects.toThrow("model.unavailable");
    } finally {
      db.close();
    }
  });
});
