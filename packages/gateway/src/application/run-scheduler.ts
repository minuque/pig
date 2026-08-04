import {
  type CommandId,
  type PiRuntimeAdapter,
  type Run,
  type RunId,
  type RunRepository,
  type RunStatus,
  type SSEEventEnvelope,
  type WorkspaceId,
  type SessionId,
} from "@no-pi-no-gang/contracts";
import { RunStateMachine } from "./run-state-machine.js";

export class RunScheduler {
  private readonly queues = new Map<string, Run[]>();
  private readonly active = new Map<string, RunId>();
  private running = 0;
  private scheduling = false;

  constructor(
    private readonly stateMachine: RunStateMachine,
    private readonly repository: RunRepository,
    private readonly runtime: PiRuntimeAdapter,
    private readonly emit: (workspaceId: WorkspaceId, event: SSEEventEnvelope) => void,
    private readonly concurrency = 2,
  ) {}

  private sessionKey(workspaceId: WorkspaceId, sessionId: SessionId) {
    return `${workspaceId}:${sessionId}`;
  }

  enqueue(run: Run, workspaceId: WorkspaceId, sessionId: SessionId) {
    const key = this.sessionKey(workspaceId, sessionId);
    const queue = this.queues.get(key) ?? [];
    queue.push(run);
    this.queues.set(key, queue);
    void this.schedule();
  }

  removeQueued(key: string, runId: string) {
    const queue = this.queues.get(key) ?? [];
    this.queues.set(
      key,
      queue.filter(({ id }) => id !== runId),
    );
  }

  getActiveId(workspaceId: WorkspaceId, sessionId: SessionId): RunId | undefined {
    const key = this.sessionKey(workspaceId, sessionId);
    return this.active.get(key);
  }

  schedule() {
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
      await this.stateMachine.executeCore(
        run,
        this.runtime,
        (r: Run) => this.active.get(this.sessionKey(r.workspaceId, r.sessionId)) === r.id,
      );
    } catch {
      // rethrown error caught here; finally still runs
    } finally {
      this.active.delete(this.sessionKey(run.workspaceId, run.sessionId));
      this.running--;
      void this.schedule();
    }
  }
}
