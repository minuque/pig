import type { PiRunEvent } from "../events/index.js";
import type {
  CommandId,
  ModelPreset,
  Run,
  RunId,
  Session,
  SessionId,
  TranscriptEntry,
  Workspace,
  WorkspaceCandidate,
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
export interface RunRepository extends Repository<Run> {
  transition(id: RunId, from: Run["status"][], next: Run): Promise<Run | undefined>;
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
    profile?: ModelPreset,
  ): Promise<{ status: "completed" | "failed" | "cancelled"; output?: string }>;
  cancelRun(runId: RunId): Promise<void>;
  steerRun(runId: RunId, input: string): Promise<void>;
  discoverSessions(workspace: Workspace): Promise<Session[]>;
  readTranscript(workspace: Workspace, sessionId: SessionId): Promise<TranscriptEntry[]>;
  discoverCandidateWorkspaces(): Promise<WorkspaceCandidate[]>;
}
