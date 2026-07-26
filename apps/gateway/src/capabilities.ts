import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { Store } from "./db/store.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

type AuthPrompt =
  | { type: "text" | "secret" | "manual_code"; message: string }
  | {
      type: "select";
      message: string;
      options: readonly { id: string; label: string }[];
    };
type AuthEvent =
  | { type: "auth_url"; url: string; instructions?: string }
  | {
      type: "device_code";
      userCode: string;
      verificationUri: string;
      expiresInSeconds?: number;
    }
  | { type: "info" | "progress"; message: string };
type AuthInteraction = {
  signal?: AbortSignal;
  prompt(prompt: AuthPrompt): Promise<string>;
  notify(event: AuthEvent): void;
};

export type PublicModel = {
  modelId: string;
  providerId: string;
  name: string;
  available: boolean;
  thinkingLevels: string[];
};
export type PublicProviderAuth = {
  providerId: string;
  revision: number;
  state: "ready" | "required" | "unavailable";
  methods: Array<"apiKey" | "authFlow">;
};
export type PublicAuthFlow = {
  flowId: string;
  providerId: string;
  revision: number;
  state: "pending" | "succeeded" | "failed" | "cancelled" | "expired" | "interrupted";
  interaction?: Record<string, unknown>;
  expiresAt: string;
};

export interface CapabilityAdapter {
  models(): Promise<PublicModel[]>;
  providerAuth(): Promise<PublicProviderAuth[]>;
  setApiKey(providerId: string, key: string): Promise<PublicProviderAuth>;
  deleteCredential(providerId: string): Promise<PublicProviderAuth>;
  login(providerId: string, interaction: AuthInteraction): Promise<void>;
}

export class PiCapabilityAdapter implements CapabilityAdapter {
  private constructor(private readonly runtime: ModelRuntime) {}
  static async create(): Promise<PiCapabilityAdapter> {
    const runtime = await ModelRuntime.create({
      authPath: join(getAgentDir(), "auth.json"),
      allowModelNetwork: false,
    });
    return new PiCapabilityAdapter(runtime);
  }
  async models(): Promise<PublicModel[]> {
    const available = new Set(
      (await this.runtime.getAvailable()).map((m) => `${m.provider}/${m.id}`),
    );
    return this.runtime.getModels().map((m) => ({
      modelId: m.id,
      providerId: m.provider,
      name: m.name,
      available: available.has(`${m.provider}/${m.id}`),
      thinkingLevels: Object.keys(m.thinkingLevelMap ?? { off: "off" }),
    }));
  }
  async providerAuth(): Promise<PublicProviderAuth[]> {
    return this.runtime.getProviders().map((p) => {
      const status = this.runtime.getProviderAuthStatus(p.id);
      const methods: Array<"apiKey" | "authFlow"> = [];
      if (p.auth.apiKey) methods.push("apiKey");
      if (p.auth.oauth) methods.push("authFlow");
      return {
        providerId: p.id,
        revision: 1,
        state: status.configured ? "ready" : "required",
        methods,
      };
    });
  }
  async setApiKey(providerId: string, key: string): Promise<PublicProviderAuth> {
    await this.runtime.setRuntimeApiKey(providerId, key);
    return (
      (await this.providerAuth()).find((x) => x.providerId === providerId) ?? {
        providerId,
        revision: 1,
        state: "unavailable",
        methods: ["apiKey"],
      }
    );
  }
  async deleteCredential(providerId: string): Promise<PublicProviderAuth> {
    await this.runtime.removeRuntimeApiKey(providerId);
    await this.runtime.logout(providerId).catch(() => undefined);
    return (
      (await this.providerAuth()).find((x) => x.providerId === providerId) ?? {
        providerId,
        revision: 1,
        state: "required",
        methods: ["apiKey"],
      }
    );
  }
  async login(providerId: string, interaction: AuthInteraction): Promise<void> {
    const provider = this.runtime.getProvider(providerId);
    if (!provider?.auth.oauth) throw new Error("provider_auth.required");
    await this.runtime.login(providerId, "oauth", interaction);
  }
}

class DeterministicCapabilityAdapter implements CapabilityAdapter {
  async models(): Promise<PublicModel[]> {
    return [
      {
        modelId: "deterministic/test:model@1",
        providerId: "deterministic",
        name: "Deterministic acceptance model",
        available: true,
        thinkingLevels: ["off", "minimal", "low", "medium", "high", "xhigh", "max"],
      },
    ];
  }

  async providerAuth(): Promise<PublicProviderAuth[]> {
    return [
      {
        providerId: "deterministic",
        revision: 1,
        state: "ready",
        methods: [],
      },
    ];
  }

  async setApiKey(): Promise<PublicProviderAuth> {
    throw new Error("provider_auth.required");
  }

  async deleteCredential(): Promise<PublicProviderAuth> {
    return (await this.providerAuth())[0]!;
  }

  async login(): Promise<void> {
    throw new Error("provider_auth.required");
  }
}

/** Internal process composition seam; it exposes no HTTP test surface. */
export function capabilityAdapterFromEnvironment(): CapabilityAdapter | undefined {
  const configured = process.env.NPNG_CAPABILITY_ADAPTER;
  if (configured === undefined) return undefined;
  if (configured === "deterministic") return new DeterministicCapabilityAdapter();
  throw new Error("server.unavailable");
}

type Pending = {
  flowId: string;
  providerId: string;
  expiresAt: number;
  revision: number;
  abort: AbortController;
  resolvers: Map<string, (value: string) => void>;
  rejecters: Map<string, (error: Error) => void>;
};

/** Gateway-owned auth orchestration. Credential values never enter Store or a public object. */
export class CapabilityCoordinator {
  private pending = new Map<string, Pending>();
  constructor(
    private readonly store: Store,
    private readonly adapterPromise: Promise<CapabilityAdapter>,
    private readonly clock = Date.now,
  ) {
    this.store.run(
      "UPDATE auth_flows SET state='interrupted',revision=revision+1,updated_at=? WHERE state='pending'",
      new Date(clock()).toISOString(),
    );
  }
  async models() {
    return (await this.adapterPromise).models();
  }
  async providerAuth() {
    const result = await (await this.adapterPromise).providerAuth();
    for (const status of result) {
      this.store.run(
        "INSERT INTO provider_auth(principal_id,provider_id,revision,state,methods_json) VALUES(?,?,?,?,?) ON CONFLICT(principal_id,provider_id) DO UPDATE SET state=excluded.state,methods_json=excluded.methods_json",
        this.principal(),
        status.providerId,
        status.revision,
        status.state,
        JSON.stringify(status.methods),
      );
    }
    return result;
  }
  async setApiKey(principalId: string, providerId: string, key: string) {
    const result = await (await this.adapterPromise).setApiKey(providerId, key);
    this.saveAuth(principalId, result);
    return result;
  }
  async deleteCredential(principalId: string, providerId: string) {
    const result = await (await this.adapterPromise).deleteCredential(providerId);
    this.saveAuth(principalId, result);
    return result;
  }
  async create(
    principalId: string,
    providerId: string,
    expiresMs = 10 * 60_000,
  ): Promise<PublicAuthFlow> {
    const flowId = randomUUID().replaceAll("-", "_");
    const now = this.clock();
    const pending: Pending = {
      flowId,
      providerId,
      expiresAt: now + expiresMs,
      revision: 1,
      abort: new AbortController(),
      resolvers: new Map(),
      rejecters: new Map(),
    };
    this.pending.set(flowId, pending);
    const initial: PublicAuthFlow = {
      flowId,
      providerId,
      revision: 1,
      state: "pending",
      expiresAt: new Date(pending.expiresAt).toISOString(),
    };
    this.store.run(
      "INSERT INTO auth_flows(flow_id,principal_id,provider_id,revision,state,interaction_json,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      flowId,
      principalId,
      providerId,
      1,
      "pending",
      null,
      initial.expiresAt,
      new Date(now).toISOString(),
      new Date(now).toISOString(),
    );
    void this.runLogin(principalId, pending);
    return initial;
  }
  get(principalId: string, flowId: string): PublicAuthFlow {
    const row = this.store.row<any>(
      "SELECT * FROM auth_flows WHERE flow_id=? AND principal_id=?",
      flowId,
      principalId,
    );
    if (!row) throw new Error("auth_flow.not_found");
    if (row.state === "pending" && this.clock() >= Date.parse(row.expires_at)) this.expire(row);
    const current = this.store.row<any>("SELECT * FROM auth_flows WHERE flow_id=?", flowId)!;
    return this.public(current);
  }
  respond(principalId: string, flowId: string, promptId: string, response: string) {
    const row = this.store.row<any>(
      "SELECT * FROM auth_flows WHERE flow_id=? AND principal_id=?",
      flowId,
      principalId,
    );
    if (!row) throw new Error("auth_flow.not_found");
    if (row.state !== "pending")
      throw new Error(row.state === "expired" ? "auth_flow.expired" : "auth_flow.invalid_state");
    const pending = this.pending.get(flowId);
    if (!pending || pending.expiresAt <= this.clock()) {
      this.expire(row);
      throw new Error("auth_flow.expired");
    }
    const resolver = pending.resolvers.get(promptId);
    if (!resolver) throw new Error("auth_flow.invalid_state");
    pending.resolvers.delete(promptId);
    pending.rejecters.delete(promptId);
    resolver(response);
    return this.get(principalId, flowId);
  }
  cancel(principalId: string, flowId: string) {
    const row = this.store.row<any>(
      "SELECT * FROM auth_flows WHERE flow_id=? AND principal_id=?",
      flowId,
      principalId,
    );
    if (!row) throw new Error("auth_flow.not_found");
    if (row.state !== "pending") throw new Error("auth_flow.invalid_state");
    this.pending.get(flowId)?.abort.abort();
    this.finish(flowId, "cancelled");
    return this.get(principalId, flowId);
  }
  private async runLogin(principalId: string, pending: Pending) {
    const interaction: AuthInteraction = {
      signal: pending.abort.signal,
      prompt: (prompt) => this.prompt(pending, prompt),
      notify: (event) => this.notify(pending, event),
    };
    try {
      await (await this.adapterPromise).login(pending.providerId, interaction);
      this.finish(pending.flowId, "succeeded");
    } catch {
      if (this.pending.has(pending.flowId))
        this.finish(pending.flowId, pending.abort.signal.aborted ? "cancelled" : "failed");
    }
    this.pending.delete(pending.flowId);
  }
  private prompt(pending: Pending, prompt: AuthPrompt): Promise<string> {
    if (pending.expiresAt <= this.clock()) return Promise.reject(new Error("auth_flow.expired"));
    const promptId = randomUUID().replaceAll("-", "_");
    const interaction =
      prompt.type === "select"
        ? {
            kind: "select",
            promptId,
            label: prompt.message,
            options: prompt.options.map((x) => ({
              value: x.id,
              label: x.label,
            })),
          }
        : {
            kind: "prompt",
            promptId,
            label: prompt.message,
            sensitive: prompt.type === "secret" || prompt.type === "manual_code",
          };
    this.update(pending.flowId, { interaction });
    return new Promise((resolve, reject) => {
      pending.resolvers.set(promptId, resolve);
      pending.rejecters.set(promptId, reject);
    });
  }
  private notify(pending: Pending, event: AuthEvent) {
    let interaction: Record<string, unknown> | undefined;
    if (event.type === "auth_url")
      interaction = {
        kind: "openUrl",
        url: event.url,
        label: event.instructions ?? "Open provider sign-in",
      };
    if (event.type === "device_code")
      interaction = {
        kind: "deviceCode",
        verificationUrl: event.verificationUri,
        userCode: event.userCode,
        expiresAt: new Date(this.clock() + (event.expiresInSeconds ?? 600) * 1000).toISOString(),
      };
    if (interaction) this.update(pending.flowId, { interaction });
  }
  private expire(row: any) {
    this.pending.get(row.flow_id)?.abort.abort();
    this.finish(row.flow_id, "expired");
  }
  private finish(flowId: string, state: PublicAuthFlow["state"]) {
    this.update(flowId, { state, interaction: null });
  }
  private update(
    flowId: string,
    change: { state?: string; interaction?: Record<string, unknown> | null },
  ) {
    this.store.run(
      "UPDATE auth_flows SET state=COALESCE(?,state),interaction_json=?,revision=revision+1,updated_at=? WHERE flow_id=? AND state='pending'",
      change.state ?? null,
      change.interaction === undefined
        ? (this.store.row<any>("SELECT interaction_json FROM auth_flows WHERE flow_id=?", flowId)
            ?.interaction_json ?? null)
        : change.interaction
          ? JSON.stringify(change.interaction)
          : null,
      new Date(this.clock()).toISOString(),
      flowId,
    );
  }
  private public(row: any): PublicAuthFlow {
    return {
      flowId: row.flow_id,
      providerId: row.provider_id,
      revision: row.revision,
      state: row.state,
      ...(row.interaction_json ? { interaction: JSON.parse(row.interaction_json) } : {}),
      expiresAt: row.expires_at,
    };
  }
  private saveAuth(principalId: string, status: PublicProviderAuth) {
    this.store.run(
      "INSERT INTO provider_auth(principal_id,provider_id,revision,state,methods_json) VALUES(?,?,?,?,?) ON CONFLICT(principal_id,provider_id) DO UPDATE SET revision=excluded.revision,state=excluded.state,methods_json=excluded.methods_json",
      principalId,
      status.providerId,
      status.revision,
      status.state,
      JSON.stringify(status.methods),
    );
  }
  private principal() {
    return (
      this.store.row<{ principal_id: string }>("SELECT principal_id FROM principals LIMIT 1")
        ?.principal_id ?? "local"
    );
  }
}
