import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import type { Store } from "../db/store.js";
import { projectSession } from "../projection/projector.js";
import type { EventHub } from "../stream/hub.js";

const TERMINAL_STATES = ["completed", "failed", "cancelled", "interrupted"];
const TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  queued: ["starting", "cancelled", "interrupted"],
  starting: ["running", "failed", "cancelling", "interrupted"],
  running: ["completed", "failed", "cancelling", "interrupted"],
  cancelling: ["cancelled", "interrupted"],
};

type RunRow = {
  run_id: string;
  session_id: string;
  command_id: string;
  prompt: string;
  profile_json: string;
  state: string;
  ordinal: number;
  retry_of_run_id: string | null;
  failure_code: string | null;
  revision: number;
  run_seq: number;
  created_at: string;
  updated_at: string;
  source_path?: string;
  workspace_id?: string;
};

export interface RuntimeExecution {
  completion: Promise<void>;
  steer(instruction: string): Promise<void>;
  cancel(): Promise<void>;
  dispose(): void;
}

export interface RuntimeAdapter {
  start(
    input: {
      sourcePath: string;
      prompt: string;
      modelId: string;
      thinkingLevel: string;
      agentDir: string;
    },
    onDelta: (target: "text" | "thinking", text: string) => void,
  ): Promise<RuntimeExecution>;
}

/** Adapter for the pinned Pi 0.82.1 SDK. */
class PiRuntimeAdapter implements RuntimeAdapter {
  async start(
    input: {
      sourcePath: string;
      prompt: string;
      modelId: string;
      thinkingLevel: string;
      agentDir: string;
    },
    onDelta: (target: "text" | "thinking", text: string) => void,
  ): Promise<RuntimeExecution> {
    const sessionManager = SessionManager.open(input.sourcePath);
    const modelRuntime = await ModelRuntime.create({
      authPath: join(input.agentDir, "auth.json"),
      modelsPath: join(input.agentDir, "models.json"),
      allowModelNetwork: false,
    });
    const matches = modelRuntime.getModels().filter((candidate) => candidate.id === input.modelId);
    if (matches.length !== 1) throw new Error("model.not_found");
    const model = matches[0]!;
    if (!modelRuntime.hasConfiguredAuth(model.provider)) {
      throw new Error("model.unavailable");
    }
    const { session } = await createAgentSession({
      cwd: sessionManager.getCwd(),
      agentDir: input.agentDir,
      modelRuntime,
      model,
      sessionManager,
      thinkingLevel: input.thinkingLevel as never,
    });
    const unsubscribe = session.subscribe((event) => {
      if (event.type !== "message_update") return;
      const update = event.assistantMessageEvent;
      if (update.type === "text_delta") onDelta("text", update.delta);
      if (update.type === "thinking_delta") onDelta("thinking", update.delta);
    });
    return {
      completion: session.prompt(input.prompt),
      steer: (instruction) => session.steer(instruction),
      // Pi abort resolves only after the AgentSession is idle/settled.
      cancel: () => session.abort(),
      dispose: () => {
        unsubscribe();
        session.dispose();
      },
    };
  }
}

function payloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class RuntimeCoordinator {
  private readonly active = new Map<string, Promise<void>>();
  private readonly controls = new Map<string, RuntimeExecution>();
  private readonly aborts = new Map<string, Promise<void>>();
  private readonly terminalWaiters = new Map<string, Set<() => void>>();
  private admission = true;
  private nextOrdinal: number;
  private readonly idleWaiters = new Set<() => void>();

  constructor(
    private readonly store: Store,
    private readonly hub: EventHub,
    private readonly agentDir: string,
    private readonly maxActive = 4,
    private readonly adapter: RuntimeAdapter = new PiRuntimeAdapter(),
    private readonly cancelTimeoutMs = 10_000,
  ) {
    const now = this.store.now();
    this.store.run(
      "UPDATE runs SET state='interrupted',updated_at=?,revision=revision+1,run_seq=run_seq+1 WHERE state NOT IN ('completed','failed','cancelled','interrupted')",
      now,
    );
    this.nextOrdinal = Number(
      this.store.row<{ ordinal: number }>("SELECT COALESCE(MAX(ordinal),0) AS ordinal FROM runs")
        ?.ordinal ?? 0,
    );
  }

  createRun(principalId: string, sessionId: string, body: any) {
    if (!this.admission) throw new Error("command.admission_closed");
    const commandPayload = { operation: "createRun", sessionId, body };
    const hash = payloadHash(commandPayload);
    const command = this.store.row<{
      payload_hash: string;
      result_json: string;
    }>(
      "SELECT payload_hash,result_json FROM commands WHERE principal_id=? AND command_id=?",
      principalId,
      body.commandId,
    );
    if (command) {
      if (command.payload_hash !== hash) throw new Error("command.idempotency_conflict");
      return JSON.parse(command.result_json);
    }
    const queued = Number(
      this.store.row<{ n: number }>(
        "SELECT count(*) AS n FROM runs WHERE session_id=? AND state='queued'",
        sessionId,
      )?.n ?? 0,
    );
    if (queued >= 32) throw new Error("run.queue_full");

    const now = this.store.now();
    const row: RunRow = {
      run_id: randomUUID().replaceAll("-", "_"),
      session_id: sessionId,
      command_id: body.commandId,
      prompt: body.prompt,
      // Admission freezes the complete profile in the durable Run row.
      profile_json: JSON.stringify({
        modelId: body.executionProfile.modelId,
        thinkingLevel: body.executionProfile.thinkingLevel,
      }),
      state: "queued",
      ordinal: ++this.nextOrdinal,
      retry_of_run_id: body.retryOfRunId ?? null,
      failure_code: null,
      revision: 1,
      run_seq: 1,
      created_at: now,
      updated_at: now,
    };
    const result = this.summary(row);
    this.store.transaction(() => {
      this.store.run(
        "INSERT INTO runs(run_id,session_id,command_id,prompt,profile_json,state,ordinal,retry_of_run_id,failure_code,revision,run_seq,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        row.run_id,
        row.session_id,
        row.command_id,
        row.prompt,
        row.profile_json,
        row.state,
        row.ordinal,
        row.retry_of_run_id,
        row.failure_code,
        row.revision,
        row.run_seq,
        row.created_at,
        row.updated_at,
      );
      this.store.run(
        "INSERT INTO commands(principal_id,command_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)",
        principalId,
        body.commandId,
        hash,
        JSON.stringify(result),
        now,
      );
    });
    this.emitState(this.scoped(row));
    this.pump();
    return result;
  }

  private scoped(row: RunRow): RunRow {
    if (row.workspace_id) return row;
    const scope = this.store.row<{ workspace_id: string }>(
      "SELECT workspace_id FROM sessions WHERE session_id=?",
      row.session_id,
    );
    return scope ? { ...row, workspace_id: scope.workspace_id } : row;
  }

  private emitState(row: RunRow): void {
    if (!row.workspace_id) return;
    this.hub.publish({
      type: "run.changed",
      workspaceId: row.workspace_id,
      sessionId: row.session_id,
      runId: row.run_id,
      runSeq: row.run_seq,
      payload: this.summary(row),
    });
  }

  private emitDelta(runId: string, target: "text" | "thinking", text: string): void {
    let emitted: RunRow | undefined;
    this.store.transaction(() => {
      const current = this.store.row<RunRow>(
        "SELECT r.*,s.workspace_id FROM runs r JOIN sessions s ON s.session_id=r.session_id WHERE r.run_id=?",
        runId,
      );
      if (!current || TERMINAL_STATES.includes(current.state)) return;
      const runSeq = Number(current.run_seq) + 1;
      this.store.run("UPDATE runs SET run_seq=? WHERE run_id=?", runSeq, runId);
      emitted = { ...current, run_seq: runSeq };
    });
    if (!emitted?.workspace_id) return;
    this.hub.publish({
      type: "run.output.delta",
      workspaceId: emitted.workspace_id,
      sessionId: emitted.session_id,
      runId: emitted.run_id,
      runSeq: emitted.run_seq,
      payload: { operation: "append", target, text },
    });
  }

  summary(row: RunRow) {
    return {
      runId: row.run_id,
      sessionId: row.session_id,
      revision: row.revision,
      state: row.state,
      executionProfile: JSON.parse(row.profile_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private pump(): void {
    if (!this.admission || this.active.size >= this.maxActive) {
      this.notifyIdle();
      return;
    }
    // Global durable admission ordinal gives FIFO fairness across Sessions;
    // skipping active Sessions preserves each Session's strict FIFO.
    const rows = this.store.all<RunRow>(
      "SELECT r.*,s.source_path,s.workspace_id FROM runs r JOIN sessions s ON s.session_id=r.session_id WHERE r.state='queued' ORDER BY r.ordinal",
    );
    for (const row of rows) {
      if (this.active.size >= this.maxActive) break;
      if (this.active.has(row.session_id)) continue;
      const task = this.execute(row).finally(() => {
        this.active.delete(row.session_id);
        this.controls.delete(row.run_id);
        this.aborts.delete(row.run_id);
        this.pump();
        this.notifyIdle();
      });
      this.active.set(row.session_id, task);
    }
    this.notifyIdle();
  }

  private notifyIdle(): void {
    if (this.active.size !== 0) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }

  waitForIdle(): Promise<void> {
    if (this.active.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.add(resolve));
  }

  private async execute(row: RunRow): Promise<void> {
    if (!this.update(row.run_id, "starting")) return;
    let execution: RuntimeExecution | undefined;
    try {
      const source = row.source_path;
      if (!source) throw new Error("session.unavailable");
      const profile = JSON.parse(row.profile_json) as {
        modelId: string;
        thinkingLevel: string;
      };
      execution = await this.adapter.start(
        {
          sourcePath: source,
          prompt: row.prompt,
          modelId: profile.modelId,
          thinkingLevel: profile.thinkingLevel,
          agentDir: this.agentDir,
        },
        (target, text) => this.emitDelta(row.run_id, target, text),
      );
      this.controls.set(row.run_id, execution);
      const current = this.row(row.run_id);
      if (!current || current.state === "interrupted") {
        await this.abortExecution(row.run_id, execution, false);
      } else if (current.state === "cancelling") {
        void this.abortExecution(row.run_id, execution, true);
      } else if (!this.admission) {
        this.update(row.run_id, "interrupted");
        await this.abortExecution(row.run_id, execution, false);
      } else {
        this.update(row.run_id, "running");
      }
      await execution.completion;
      const settled = this.row(row.run_id);
      if (settled?.state === "running") {
        // Pi has settled and persisted JSONL; refresh durable transcript truth
        // before exposing the immutable completed transition.
        await projectSession(this.store, row.session_id, source);
        this.update(row.run_id, "completed");
      } else if (settled?.state === "cancelling") {
        await this.aborts.get(row.run_id);
      }
    } catch {
      const current = this.row(row.run_id);
      if (current?.state === "cancelling") {
        this.update(row.run_id, "interrupted", "run.cancel_unsettled");
      } else if (current && !TERMINAL_STATES.includes(current.state)) {
        this.update(row.run_id, "failed", "run.failed");
      }
    } finally {
      try {
        execution?.dispose();
      } catch {}
    }
  }

  private row(runId: string): RunRow | undefined {
    return this.store.row<RunRow>("SELECT * FROM runs WHERE run_id=?", runId);
  }

  update(runId: string, state: string, failureCode?: string): boolean {
    let emitted: RunRow | undefined;
    this.store.transaction(() => {
      const current = this.store.row<RunRow>(
        "SELECT r.*,s.workspace_id FROM runs r JOIN sessions s ON s.session_id=r.session_id WHERE r.run_id=?",
        runId,
      );
      if (
        !current ||
        TERMINAL_STATES.includes(current.state) ||
        !TRANSITIONS[current.state]?.includes(state)
      )
        return;
      const revision = Number(current.revision) + 1;
      const runSeq = Number(current.run_seq) + 1;
      const updatedAt = this.store.now();
      this.store.run(
        "UPDATE runs SET state=?,failure_code=?,revision=?,run_seq=?,updated_at=? WHERE run_id=?",
        state,
        failureCode ?? null,
        revision,
        runSeq,
        updatedAt,
        runId,
      );
      emitted = {
        ...current,
        revision,
        run_seq: runSeq,
        state,
        failure_code: failureCode ?? null,
        updated_at: updatedAt,
      };
    });
    if (!emitted) return false;
    this.emitState(emitted);
    if (TERMINAL_STATES.includes(emitted.state)) this.resolveTerminal(runId);
    return true;
  }

  async cancel(runId: string, principalId = "local", commandId?: string): Promise<void> {
    const payload = { operation: "cancel", runId };
    if (commandId && this.replayCommand(principalId, commandId, payload)) return;
    const row = this.row(runId);
    if (!row) throw new Error("run.not_found");
    if (TERMINAL_STATES.includes(row.state)) throw new Error("run.invalid_state");
    if (row.state === "queued") {
      this.update(runId, "cancelled");
    } else {
      if (row.state !== "cancelling" && !this.update(runId, "cancelling")) {
        throw new Error("run.invalid_state");
      }
      const control = this.controls.get(runId);
      if (control) void this.abortExecution(runId, control, true);
      await this.waitForCancellationBoundary(runId);
    }
    if (commandId) this.saveCommand(principalId, commandId, payload, { runId });
  }

  private abortExecution(
    runId: string,
    control: RuntimeExecution,
    confirmCancelled: boolean,
  ): Promise<void> {
    const existing = this.aborts.get(runId);
    if (existing) return existing;
    const abort = (async () => {
      try {
        await control.cancel();
        if (confirmCancelled) {
          const current = this.store.row<RunRow>(
            "SELECT r.*,s.source_path FROM runs r JOIN sessions s ON s.session_id=r.session_id WHERE r.run_id=?",
            runId,
          );
          if (current?.source_path) {
            await projectSession(this.store, current.session_id, current.source_path);
          }
          this.update(runId, "cancelled");
        }
      } catch {
        if (confirmCancelled) {
          this.update(runId, "interrupted", "run.cancel_unsettled");
        }
      }
    })();
    this.aborts.set(runId, abort);
    return abort;
  }

  private waitForCancellationBoundary(runId: string): Promise<void> {
    const terminal = this.waitForTerminal(runId);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.update(runId, "interrupted", "run.cancel_timeout");
        resolve();
      }, this.cancelTimeoutMs);
      void terminal.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private waitForTerminal(runId: string): Promise<void> {
    const current = this.row(runId);
    if (!current || TERMINAL_STATES.includes(current.state)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const waiters = this.terminalWaiters.get(runId) ?? new Set();
      waiters.add(resolve);
      this.terminalWaiters.set(runId, waiters);
    });
  }

  private resolveTerminal(runId: string): void {
    const waiters = this.terminalWaiters.get(runId);
    if (!waiters) return;
    this.terminalWaiters.delete(runId);
    for (const resolve of waiters) resolve();
  }

  async steer(
    runId: string,
    instruction: string,
    principalId = "local",
    commandId?: string,
  ): Promise<void> {
    if (!instruction) throw new Error("request.validation_failed");
    const payload = { operation: "steer", runId, instruction };
    if (commandId && this.replayCommand(principalId, commandId, payload)) return;
    const row = this.row(runId);
    if (!row) throw new Error("run.not_found");
    if (row.state !== "running") throw new Error("run.invalid_state");
    const control = this.controls.get(runId);
    if (!control) throw new Error("run.invalid_state");
    await control.steer(instruction);
    if (commandId) this.saveCommand(principalId, commandId, payload, { runId });
  }

  private replayCommand(principalId: string, commandId: string, payload: unknown): boolean {
    const row = this.store.row<{ payload_hash: string }>(
      "SELECT payload_hash FROM commands WHERE principal_id=? AND command_id=?",
      principalId,
      commandId,
    );
    if (!row) return false;
    if (row.payload_hash !== payloadHash(payload)) {
      throw new Error("command.idempotency_conflict");
    }
    return true;
  }

  private saveCommand(
    principalId: string,
    commandId: string,
    payload: unknown,
    result: unknown,
  ): void {
    this.store.run(
      "INSERT INTO commands(principal_id,command_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)",
      principalId,
      commandId,
      payloadHash(payload),
      JSON.stringify(result),
      this.store.now(),
    );
  }

  async close(): Promise<void> {
    if (!this.admission) {
      await this.waitForIdle();
      return;
    }
    this.admission = false;
    const pending = this.store.all<RunRow>(
      "SELECT * FROM runs WHERE state NOT IN ('completed','failed','cancelled','interrupted')",
    );
    for (const row of pending) {
      if (row.state === "queued") this.update(row.run_id, "interrupted");
      else if (row.state !== "cancelling") this.update(row.run_id, "cancelling");
    }
    await Promise.allSettled(
      [...this.controls.entries()].map(([runId, control]) =>
        this.abortExecution(runId, control, false),
      ),
    );
    for (const row of pending) this.update(row.run_id, "interrupted");
    await this.waitForIdle();
  }
}
