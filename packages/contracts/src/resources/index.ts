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

export interface ExecutionProfile {
  model: string;
  thinkingLevel: string;
}

export interface RuntimeCapabilities {
  profiles: ExecutionProfile[];
}

export interface Run {
  id: RunId;
  workspaceId: WorkspaceId;
  sessionId: SessionId;
  prompt: string;
  commandId: CommandId;
  profile?: ExecutionProfile;
  status: "admission" | "queued" | "running" | "cancelling" | "cancelled" | "failed" | "completed";
  output?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalIdentity {
  id: LocalIdentityId;
}
export type TranscriptEntry = Record<string, unknown>;
