import { randomUUID } from "crypto";
import {
  CONTRACT_VERSION,
  InMemoryCommandExecutor,
  type CommandId,
  type LocalIdentityId,
  type PiRuntimeAdapter,
  type Run,
  type RunId,
  type RunRepository,
  type SSEEventEnvelope,
  type SessionId,
  type SingleActiveRunStrategy,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";
import { SessionsApplication } from "./sessions.js";

export class ActiveRunConflictError extends Error {}
export class RunNotFoundError extends Error {}
export const terminalStatuses = new Set<Run["status"]>(["completed", "failed", "cancelled"]);

export class RunsApplication {
  private readonly commands = new InMemoryCommandExecutor();
  private readonly terminalEvents = new Set<RunId>();

  constructor(
    private readonly sessions: SessionsApplication,
    private readonly runtime: PiRuntimeAdapter,
    private readonly repository: RunRepository,
    private readonly activePolicy: SingleActiveRunStrategy,
    private readonly emit: (workspaceId: WorkspaceId, event: SSEEventEnvelope) => void,
  ) {}

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
  ) {
    await this.sessions.get(identityId, workspaceId, sessionId);
    return this.commands.execute(
      commandId,
      { workspaceId, sessionId, prompt, identityId },
      async () => {
        const now = new Date();
        const run: Run = {
          id: randomUUID() as RunId,
          workspaceId,
          sessionId,
          commandId,
          prompt,
          status: "admission",
          createdAt: now,
          updatedAt: now,
        };
        if (!(await this.activePolicy.tryAcquire(run))) throw new ActiveRunConflictError();
        await this.repository.save(run);
        void this.execute(run);
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
      { workspaceId, sessionId, runId: run.id, identityId },
      async () => {
        const current = await this.repository.findById(run.id);
        if (!current || terminalStatuses.has(current.status)) return current ?? run;
        await this.runtime.cancelRun(run.id);
        const cancelled = await this.repository.save({
          ...current,
          status: "cancelled",
          updatedAt: new Date(),
        });
        await this.activePolicy.release(run.id);
        this.emitTerminal(cancelled);
        return cancelled;
      },
    );
  }

  private async execute(run: Run) {
    try {
      const running = await this.repository.save({
        ...run,
        status: "running",
        updatedAt: new Date(),
      });
      this.emitEvent(running, "run.running", { status: "running" });
      const settled = await this.runtime.createRun(
        running.sessionId,
        running.prompt,
        running.commandId,
        (event) => void this.emitIncrement(running, event.type, event.data),
      );
      const saved = await this.repository.save({
        ...running,
        ...settled,
        id: running.id,
        workspaceId: running.workspaceId,
        sessionId: running.sessionId,
        commandId: running.commandId,
        prompt: running.prompt,
        updatedAt: new Date(),
      });
      this.emitTerminal(saved);
    } catch {
      this.emitTerminal(
        await this.repository.save({ ...run, status: "failed", updatedAt: new Date() }),
      );
    } finally {
      await this.activePolicy.release(run.id);
    }
  }

  private async emitIncrement(run: Run, type: string, data: unknown) {
    const current = await this.repository.findById(run.id);
    if (current && !terminalStatuses.has(current.status)) this.emitEvent(run, type, data);
  }

  private emitTerminal(run: Run) {
    if (!terminalStatuses.has(run.status) || this.terminalEvents.has(run.id)) return;
    this.terminalEvents.add(run.id);
    this.emitEvent(run, `run.${run.status}`, { status: run.status, output: run.output });
  }

  private emitEvent(run: Run, type: string, data: unknown) {
    this.emit(run.workspaceId, {
      version: CONTRACT_VERSION,
      type,
      data,
      sessionId: run.sessionId,
      runId: run.id,
      timestamp: new Date(),
    });
  }
}
