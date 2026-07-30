export const CONTRACT_VERSION = "0.1.0" as const;

export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type RunId = string & { readonly __brand: "RunId" };
export type LocalIdentityId = string & { readonly __brand: "LocalIdentityId" };
export type CommandId = string & { readonly __brand: "CommandId" };

export interface Workspace {
  id: WorkspaceId;
  name: string;
  canonicalPath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceAccess {
  localIdentityId: LocalIdentityId;
  workspaceId: WorkspaceId;
}

export interface Session {
  id: SessionId;
  workspaceId: WorkspaceId;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  status: "available" | "unavailable";
}

export interface Run {
  id: RunId;
  sessionId: SessionId;
  prompt: string;
  runId: RunId;
  commandId?: CommandId;
  status: "admission" | "running" | "terminal" | "cancelled" | "failed" | "completed";
  output?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalIdentity {
  id: LocalIdentityId;
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
  canonicalizeWorkspacePath(candidatePath: string): Promise<string>;
  getPlatformPath(): Promise<string>;
}

export class CommandConflictError extends Error {
  constructor() {
    super("commandId was already used with a different payload");
  }
}

export interface CommandExecutor {
  execute<T>(commandId: CommandId, payload: unknown, operation: () => Promise<T>): Promise<T>;
}

export class InMemoryCommandExecutor implements CommandExecutor {
  private readonly commands = new Map<CommandId, { payload: string; result: Promise<unknown> }>();

  execute<T>(commandId: CommandId, payload: unknown, operation: () => Promise<T>): Promise<T> {
    const serialized = JSON.stringify(payload);
    const previous = this.commands.get(commandId);
    if (previous) {
      if (previous.payload !== serialized) throw new CommandConflictError();
      return previous.result as Promise<T>;
    }
    const result = operation();
    this.commands.set(commandId, { payload: serialized, result });
    return result;
  }
}

export interface SingleWorkspaceStrategy {
  getCanonicalWorkspace(): Promise<Workspace | undefined>;
  setCanonicalWorkspace(workspace: Workspace): Promise<void>;
}

export interface SingleActiveRunStrategy {
  getActiveRun(): Promise<Run | undefined>;
  setActiveRun(run: Run): Promise<void>;
}

export type TranscriptEntry = Record<string, unknown>;

export interface PiRuntimeAdapter {
  startSession(workspace: Workspace, name?: string): Promise<Session>;
  createRun(sessionId: SessionId, prompt: string, commandId?: CommandId): Promise<Run>;
  cancelRun(runId: RunId): Promise<void>;
  discoverSessions(workspace: Workspace): Promise<Session[]>;
  readTranscript(workspace: Workspace, sessionId: SessionId): Promise<TranscriptEntry[]>;
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
