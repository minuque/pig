import type { RunStatus } from "../run-state.js";

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

export interface WorkspaceCandidate {
  canonicalPath: string;
  name: string;
  lastModified: string;
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

export interface ModelPreset {
  model: string;
  thinkingLevel: string;
}

/** 模型目录（Model Picker 展示用）：供应商 → 模型列表。 */
export interface ModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  thinkingLevels: string[];
  contextWindow?: number;
  /** 品牌名（如 "OpenAI"），供 Picker 展示，来自供应商元数据 */
  brand?: string;
  /** 模型描述，供 Picker 展示；缺省时前端回退到模型名 */
  description?: string;
}

export interface ModelVendor {
  id: string;
  name: string;
  models: ModelInfo[];
}

export interface RuntimeCapabilities {
  presets: ModelPreset[];
  catalog: ModelVendor[];
}

export interface Run {
  id: RunId;
  workspaceId: WorkspaceId;
  sessionId: SessionId;
  prompt: string;
  commandId: CommandId;
  profile?: ModelPreset;
  status: RunStatus;
  output?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalIdentity {
  id: LocalIdentityId;
}
export type TranscriptEntry = Record<string, unknown>;
