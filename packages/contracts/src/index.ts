export const CONTRACT_VERSION = "0.1.0" as const;

export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type RunId = string & { readonly __brand: "RunId" };
export type LocalIdentityId = string & { readonly __brand: "LocalIdentityId" };
export type CommandId = string & { readonly __brand: "CommandId" };

export interface Workspace {
  id: WorkspaceId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  canonical?: boolean; // for Phase 0, single canonical workspace
}

export interface Session {
  id: SessionId;
  workspaceId: WorkspaceId;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  status: "available" | "unavailable";
  // Session Index will point to Pi JSONL file
}

export interface Run {
  id: RunId;
  sessionId: SessionId;
  prompt: string;
  runId: RunId; // unique per prompt
  commandId?: CommandId; // client generated for idempotency
  status: "admission" | "running" | "terminal" | "cancelled" | "failed" | "completed";
  output?: string; // accumulated output
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalIdentity {
  id: LocalIdentityId;
  workspaceId: WorkspaceId;
  sessionId?: SessionId;
  // credential mapped to this identity
}

export interface SSEEventEnvelope {
  version: string;
  type: string;
  data: unknown;
  sessionId?: SessionId;
  runId?: RunId;
  timestamp?: Date;
}

export interface Repository<T> {
  findById(id: string): Promise<T | undefined>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<boolean>;
  findAll(): Promise<T[]>;
}

export interface PlatformPort {
  resolveWorkspacePath(workspaceId: WorkspaceId): Promise<string>;
  getPlatformPath(): Promise<string>;
}

export interface CommandExecutor {
  execute<T>(command: any, commandId: CommandId): Promise<T>;
  // idempotent: same commandId returns cached result immediately
}

export interface SingleWorkspaceStrategy {
  getCanonicalWorkspace(): Promise<Workspace | undefined>;
  setCanonicalWorkspace(workspace: Workspace): Promise<void>;
}

export interface SingleActiveRunStrategy {
  getActiveRun(): Promise<Run | undefined>;
  setActiveRun(run: Run): Promise<void>;
}

export interface PiRuntimeAdapter {
  // Gateway uses this to call Pi Runtime - fixed version dependency
  startSession(workspaceId: WorkspaceId): Promise<Session>;
  createRun(sessionId: SessionId, prompt: string, commandId?: CommandId): Promise<Run>;
  cancelRun(runId: RunId): Promise<void>;
  discoverSessions(): Promise<Session[]>;
  // etc for MVP
}

export class SingleWorkspaceStrategyImpl implements SingleWorkspaceStrategy {
  private canonicalWorkspace?: Workspace;
  async getCanonicalWorkspace(): Promise<Workspace | undefined> {
    return this.canonicalWorkspace;
  }
  async setCanonicalWorkspace(workspace: Workspace): Promise<void> {
    this.canonicalWorkspace = workspace;
  }
}

export class SingleActiveRunStrategyImpl implements SingleActiveRunStrategy {
  private activeRun?: Run;
  async getActiveRun(): Promise<Run | undefined> {
    return this.activeRun;
  }
  async setActiveRun(run: Run): Promise<void> {
    this.activeRun = run;
  }
}
