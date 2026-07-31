import type { PiRunEvent } from "../events/index.js";
import type {
  CommandId,
  ExecutionProfile,
  Run,
  RunId,
  Session,
  SessionId,
  TranscriptEntry,
  Workspace,
  WorkspaceId,
} from "../resources/index.js";

export interface Repository<T> {
  findById(id: string): Promise<T | undefined>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<boolean>;
  findAll(): Promise<T[]>;
}
export interface PlatformPort {
  selectWorkspaceDirectory(): Promise<string | undefined>;
  canonicalizeWorkspacePath(candidatePath: string): Promise<string>;
}
export interface SingleWorkspaceStrategy {
  getCanonicalWorkspace(): Promise<Workspace | undefined>;
  setCanonicalWorkspace(workspace: Workspace): Promise<void>;
}
export interface RunRepository extends Repository<Run> {
  transition(id: RunId, from: Run["status"][], next: Run): Promise<Run | undefined>;
}
export interface SingleActiveRunStrategy {
  tryAcquire(run: Run): Promise<boolean>;
  release(runId: RunId): Promise<void>;
}
export interface PiRuntimeAdapter {
  startSession(workspace: Workspace, name?: string): Promise<Session>;
  capabilities(): Promise<import("../resources/index.js").RuntimeCapabilities>;
  createRun(
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    prompt: string,
    commandId?: CommandId,
    onEvent?: (event: PiRunEvent) => void,
    profile?: ExecutionProfile,
  ): Promise<{ status: "completed" | "failed" | "cancelled"; output?: string }>;
  cancelRun(runId: RunId): Promise<void>;
  steerRun(runId: RunId, input: string): Promise<void>;
  discoverSessions(workspace: Workspace): Promise<Session[]>;
  readTranscript(workspace: Workspace, sessionId: SessionId): Promise<TranscriptEntry[]>;
}
export class SingleWorkspaceStrategyImpl implements SingleWorkspaceStrategy {
  private canonicalWorkspace?: Workspace;
  async getCanonicalWorkspace() {
    return this.canonicalWorkspace;
  }
  async setCanonicalWorkspace(workspace: Workspace) {
    this.canonicalWorkspace = workspace;
  }
}
export class SingleActiveRunStrategyImpl implements SingleActiveRunStrategy {
  private activeRun: Run | undefined;
  async tryAcquire(run: Run) {
    if (this.activeRun) return false;
    this.activeRun = run;
    return true;
  }
  async release(runId: RunId) {
    if (this.activeRun?.id === runId) this.activeRun = undefined;
  }
}
