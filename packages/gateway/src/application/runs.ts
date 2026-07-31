import { randomUUID } from "crypto";
import {
  CONTRACT_VERSION,
  InMemoryCommandExecutor,
  type CommandId,
  type ExecutionProfile,
  type LocalIdentityId,
  type PiRuntimeAdapter,
  type Run,
  type RunId,
  type RunRepository,
  type SSEEventEnvelope,
  type SessionId,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";
import { SessionsApplication } from "./sessions.js";

export class RunNotFoundError extends Error {}
export class InvalidExecutionProfileError extends Error {}
export class InvalidRunStateError extends Error {}
export const terminalStatuses = new Set<Run["status"]>(["completed", "failed", "cancelled"]);

export class RunsApplication {
  private readonly commands = new InMemoryCommandExecutor();
  private readonly terminalEvents = new Set<RunId>();
  private readonly queues = new Map<string, Run[]>();
  private readonly active = new Map<string, RunId>();
  private running = 0;
  private scheduling = false;
  constructor(
    private readonly sessions: SessionsApplication,
    private readonly runtime: PiRuntimeAdapter,
    private readonly repository: RunRepository,
    private readonly emit: (workspaceId: WorkspaceId, event: SSEEventEnvelope) => void,
    private readonly concurrency = 2,
  ) {}
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
    profile?: ExecutionProfile,
  ) {
    await this.sessions.get(identityId, workspaceId, sessionId);
    const capabilities = await this.runtime.capabilities();
    const frozen = profile ?? capabilities.profiles[0];
    if (
      !frozen ||
      !capabilities.profiles.some(
        (p) => p.model === frozen.model && p.thinkingLevel === frozen.thinkingLevel,
      )
    )
      throw new InvalidExecutionProfileError();
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
        const key = this.sessionKey(workspaceId, sessionId);
        const queue = this.queues.get(key) ?? [];
        queue.push(run);
        this.queues.set(key, queue);
        void this.schedule();
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
        if (current.status === "queued" && this.active.get(key) !== current.id) {
          const cancelled = await this.repository.transition(current.id, ["queued"], {
            ...current,
            status: "cancelled",
            updatedAt: new Date(),
          });
          if (!cancelled) return (await this.repository.findById(current.id)) ?? current;
          const queue = this.queues.get(key) ?? [];
          this.queues.set(
            key,
            queue.filter(({ id }) => id !== current.id),
          );
          this.emitTerminal(cancelled);
          return cancelled;
        }
        if (current.status === "cancelling") return current;
        const cancelling = await this.repository.transition(current.id, ["running"], {
          ...current,
          status: "cancelling",
          updatedAt: new Date(),
        });
        if (!cancelling) return (await this.repository.findById(current.id)) ?? current;
        this.emitEvent(cancelling, "run.cancelling", { status: "cancelling" });
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
    if (
      run.status !== "running" ||
      this.active.get(this.sessionKey(workspaceId, sessionId)) !== run.id
    )
      throw new InvalidRunStateError();
    await this.runtime.steerRun(run.id, input);
    return run;
  }
  private schedule() {
    if (this.scheduling) return;
    this.scheduling = true;
    try {
      while (this.running < this.concurrency) {
        const entry = [...this.queues].find(
          ([key, queue]) => queue.length && !this.active.has(key),
        );
        if (!entry) return;
        const [key, queue] = entry;
        const run = queue.shift()!;
        this.active.set(key, run.id);
        this.running++;
        void this.execute(run);
      }
    } finally {
      this.scheduling = false;
    }
  }
  private async execute(run: Run) {
    try {
      const running = await this.repository.transition(run.id, ["queued"], {
        ...run,
        status: "running",
        updatedAt: new Date(),
      });
      if (!running) return;
      this.emitEvent(running, "run.running", { status: "running", profile: running.profile });
      const settled = await this.runtime.createRun(
        running.workspaceId,
        running.sessionId,
        running.prompt,
        running.id as unknown as CommandId,
        (event) => void this.emitIncrement(running, event.type, event.data),
        running.profile,
      );
      const saved = await this.repository.transition(run.id, ["running", "cancelling"], {
        ...running,
        ...settled,
        updatedAt: new Date(),
      });
      if (saved) this.emitTerminal(saved);
    } catch {
      const failed = await this.repository.transition(run.id, ["queued", "running", "cancelling"], {
        ...run,
        status: "failed",
        updatedAt: new Date(),
      });
      if (failed) this.emitTerminal(failed);
    } finally {
      this.active.delete(this.sessionKey(run.workspaceId, run.sessionId));
      this.running--;
      void this.schedule();
    }
  }
  private async cancelRuntime(run: Run) {
    try {
      await this.runtime.cancelRun(run.id);
    } catch {
      const failed = await this.repository.transition(run.id, ["cancelling"], {
        ...run,
        status: "failed",
        updatedAt: new Date(),
      });
      if (failed) this.emitTerminal(failed);
    }
  }
  private sessionKey(workspaceId: WorkspaceId, sessionId: SessionId) {
    return `${workspaceId}:${sessionId}`;
  }
  private async emitIncrement(run: Run, type: string, data: unknown) {
    const current = await this.repository.findById(run.id);
    if (current?.status === "running") this.emitEvent(run, type, data);
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
      workspaceId: run.workspaceId,
      sessionId: run.sessionId,
      runId: run.id,
      timestamp: new Date(),
    });
  }
}
