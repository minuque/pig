export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  canonical?: boolean; // for Phase 0, single canonical workspace
}

export interface Session {
  id: string;
  workspaceId: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'available' | 'unavailable';
  // Session Index will point to Pi JSONL file
}

export interface Run {
  id: string;
  sessionId: string;
  prompt: string;
  runId: string; // unique per prompt
  commandId?: string; // client generated for idempotency
  status: 'admission' | 'running' | 'terminal' | 'cancelled' | 'failed' | 'completed';
  output?: string; // accumulated output
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalIdentity {
  id: string;
  workspaceId: string;
  sessionId?: string;
  // credential mapped to this identity
}

export type CommandId = string;

export interface PiRuntimeAdapter {
  // Gateway uses this to call Pi Runtime
  startSession(workspaceId: string): Promise<Session>;
  createRun(sessionId: string, prompt: string, commandId?: string): Promise<Run>;
  cancelRun(runId: string): Promise<void>;
  // etc for MVP
}

