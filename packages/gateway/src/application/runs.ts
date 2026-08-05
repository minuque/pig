import { randomUUID } from "crypto";
import {
  canTransition,
  CONTRACT_VERSION,
  InMemoryCommandExecutor,
  terminalStatuses,
  type CommandId,
  type ErrorCode,
  type LocalIdentityId,
  type ModelPreset,
  type PiRuntimeAdapter,
  type Run,
  type RunId,
  type RunRepository,
  type SSEEventEnvelope,
  type SessionId,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";
import { SessionsApplication } from "./sessions.js";
import { RunScheduler } from "./run-scheduler.js";
import { RunStateMachine } from "./run-state-machine.js";

export class RunNotFoundError extends Error {
  readonly code: ErrorCode = "RUN_NOT_FOUND";
}
export class InvalidModelPresetError extends Error {
  readonly code: ErrorCode = "INVALID_MODEL_PRESET";
}
export class InvalidRunStateError extends Error {
  readonly code: ErrorCode = "INVALID_RUN_STATE";
}

export class RunsApplication {
  private readonly commands = new InMemoryCommandExecutor();
  private readonly scheduler: RunScheduler;
  private readonly stateMachine: RunStateMachine;
  constructor(
    private readonly sessions: SessionsApplication,
    private readonly runtime: PiRuntimeAdapter,
    private readonly repository: RunRepository,
    private readonly emit: (workspaceId: WorkspaceId, event: SSEEventEnvelope) => void,
    private readonly concurrency = 2,
  ) {
    this.stateMachine = new RunStateMachine(this.emit, this.repository);
    this.scheduler = new RunScheduler(
      this.stateMachine,
      this.repository,
      this.runtime,
      this.emit,
      this.concurrency,
    );
  }
  capabilities() {
    return this.runtime.capabilities();
  }
  private async existing(
    identityId: LocalIdentityId,
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    runId: string,
  ) {
    await this.sessions.get(identityId, workspaceId, sessionId);
    const run = await this.repository.findById(runId);
    if (!run || run.workspaceId !== workspaceId || run.sessionId !== sessionId)
      throw new RunNotFoundError();
    return run;
  }
  get(identityId: LocalIdentityId, workspaceId: WorkspaceId, sessionId: SessionId, runId: string) {
    return this.existing(identityId, workspaceId, sessionId, runId);
  }
  async create(
    identityId: LocalIdentityId,
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    prompt: string,
    commandId: CommandId,
    profile?: ModelPreset,
  ) {
    await this.sessions.get(identityId, workspaceId, sessionId);
    const capabilities = await this.runtime.capabilities();
    const frozen = profile ?? capabilities.presets[0];
    if (
      !frozen ||
      !capabilities.presets.some(
        (p) => p.model === frozen.model && p.thinkingLevel === frozen.thinkingLevel,
      )
    )
      throw new InvalidModelPresetError();
    return this.commands.execute(
      commandId,
      { workspaceId, sessionId, prompt, identityId, profile: frozen },
      async () => {
        const now = new Date();
        const run: Run = {
          id: randomUUID() as RunId,
          workspaceId,
          sessionId,
          commandId,
          prompt,
          profile: { ...frozen },
          status: "queued",
          createdAt: now,
          updatedAt: now,
        };
        await this.repository.save(run);
        this.scheduler.enqueue(run, workspaceId, sessionId);
        return run;
      },
    );
  }
  async cancel(
    identityId: LocalIdentityId,
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    runId: string,
    commandId: CommandId,
  ) {
    const run = await this.existing(identityId, workspaceId, sessionId, runId);
    return this.commands.execute(
      commandId,
      { workspaceId, sessionId, runId, identityId },
      async () => {
        const current = await this.repository.findById(run.id);
        if (!current || terminalStatuses.has(current.status)) return current ?? run;
        const key = this.sessionKey(workspaceId, sessionId);
        if (
          current.status === "queued" &&
          this.scheduler.getActiveId(workspaceId, sessionId) !== current.id
        ) {
          const currentStatus = current.status;
          if (!canTransition(currentStatus, "cancelled"))
            return (await this.repository.findById(current.id)) ?? current;
          const cancelled = await this.repository.transition(current.id, [currentStatus], {
            ...current,
            status: "cancelled",
            updatedAt: new Date(),
          });
          if (!cancelled) return (await this.repository.findById(current.id)) ?? current;
          this.scheduler.removeQueued(key, current.id);
          this.stateMachine.emitTerminal(cancelled);
          return cancelled;
        }
        if (current.status === "cancelling") return current;
        const currentStatus = current.status;
        if (!canTransition(currentStatus, "cancelling"))
          return (await this.repository.findById(current.id)) ?? current;
        const cancelling = await this.repository.transition(current.id, [currentStatus], {
          ...current,
          status: "cancelling",
          updatedAt: new Date(),
        });
        if (!cancelling) return (await this.repository.findById(current.id)) ?? current;
        this.stateMachine.markCancelling(cancelling.id);
        this.stateMachine.emitEvent(cancelling, "run.cancelling", { status: "cancelling" });
        void this.cancelRuntime(cancelling);
        return cancelling;
      },
    );
  }
  async steer(
    identityId: LocalIdentityId,
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    runId: string,
    input: string,
  ) {
    const run = await this.existing(identityId, workspaceId, sessionId, runId);
    if (run.status !== "running" || this.scheduler.getActiveId(workspaceId, sessionId) !== run.id)
      throw new InvalidRunStateError();
    await this.runtime.steerRun(run.id, input);
    return run;
  }
  private sessionKey(workspaceId: WorkspaceId, sessionId: SessionId) {
    return `${workspaceId}:${sessionId}`;
  }
  private async cancelRuntime(run: Run) {
    try {
      await this.runtime.cancelRun(run.id);
    } catch {
      const current = await this.repository.findById(run.id);
      if (current && canTransition(current.status, "failed")) {
        const failed = await this.repository.transition(run.id, [current.status], {
          ...run,
          status: "failed",
          updatedAt: new Date(),
        });
        if (failed) this.stateMachine.emitTerminal(failed);
      }
    }
  }
}
