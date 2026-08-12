import {
  canTransition,
  type CommandId,
  type PiRuntimeAdapter,
  type Run,
  type RunId,
  type RunRepository,
  type RunStatus,
  type SSEEventEnvelope,
  type WorkspaceId,
  terminalStatuses,
  CONTRACT_VERSION,
} from "@pig/contracts";

export class RunStateMachine {
  private readonly terminalEvents = new Set<RunId>();

  constructor(
    private readonly emit: (workspaceId: WorkspaceId, event: SSEEventEnvelope) => void,
    private readonly repository: RunRepository,
  ) {}

  public emitEvent(run: Run, type: string, data: unknown) {
    this.emit(run.workspaceId, {
      version: CONTRACT_VERSION,
      type,
      data,
      workspaceId: run.workspaceId,
      sessionId: run.sessionId,
      runId: run.id,
      sequence: 0,
      timestamp: new Date(),
    });
  }

  public emitTerminal(run: Run) {
    if (!terminalStatuses.has(run.status) || this.terminalEvents.has(run.id)) return;
    this.terminalEvents.add(run.id);
    this.emitEvent(run, `run.${run.status}`, { status: run.status, output: run.output });
  }

  private async emitIncrement(
    run: Run,
    type: string,
    data: unknown,
    isRunning: (r: Run) => boolean,
  ) {
    if (isRunning(run) && !this.cancelling.has(run.id)) this.emitEvent(run, type, data);
  }

  /** 记录已进入 cancelling 的 run，期间停止增量事件发射；settle 后由 executeCore 清除 */
  private readonly cancelling = new Set<RunId>();
  markCancelling(runId: RunId) {
    this.cancelling.add(runId);
  }
  clearCancelling(runId: RunId) {
    this.cancelling.delete(runId);
  }

  private async transition(
    runId: RunId,
    currentStatus: RunStatus,
    next: Run,
  ): Promise<Run | undefined> {
    if (!canTransition(currentStatus, next.status)) return;
    return await this.repository.transition(runId, [currentStatus], {
      ...next,
      updatedAt: new Date(),
    });
  }

  async executeCore(
    run: Run,
    runtime: PiRuntimeAdapter,
    isRunning: (r: Run) => boolean,
  ): Promise<Run | undefined> {
    try {
      // queued -> running
      const running = await this.transition(run.id, run.status, { ...run, status: "running" });
      if (!running) return;
      this.emitEvent(running, "run.running", { status: "running", profile: running.profile });

      const settled = await runtime.createRun(
        running.workspaceId,
        running.sessionId,
        running.prompt,
        running.id as unknown as CommandId,
        (event) => void this.emitIncrement(running, event.type, event.data, isRunning),
        running.profile,
      );

      // saved transition
      const saved = await (async () => {
        const current = await this.repository.findById(run.id);
        if (!current) return;
        const nextRun = {
          ...running,
          ...(settled as any),
          updatedAt: new Date(),
        } as Run;
        const nextStatus = nextRun.status as RunStatus;
        if (!canTransition(current.status, nextStatus)) return;
        return await this.transition(run.id, current.status, nextRun);
      })();
      if (saved) {
        this.clearCancelling(run.id);
        this.emitTerminal(saved);
      }
      return saved;
    } catch {
      const current = await this.repository.findById(run.id);
      if (current && canTransition(current.status, "failed")) {
        const failed = await this.transition(run.id, current.status, {
          ...run,
          status: "failed",
        });
        if (failed) {
          this.clearCancelling(run.id);
          this.emitTerminal(failed);
        }
      }
      throw new Error("Run execution failed");
    }
  }
}
