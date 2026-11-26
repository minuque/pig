import type {
  AgentConfigScope,
  FileTextResponse,
  LoginEvent,
  McpExposure,
  McpProbeReport,
  McpScopeView,
  SkillFileView,
  SkillScopeView,
} from "@pig/protocol"

import { openLoginEvents, request } from "@client/platform.js"

export function getMcpScope(scope: AgentConfigScope): Promise<McpScopeView> {
  return request("GET /api/v1/platform/mcp", { query: { scope } })
}

export function saveMcpServer(input: {
  scope: AgentConfigScope
  name: string
  previousName?: string
  overwrite?: boolean
  config: Record<string, unknown>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return request("PUT /api/v1/platform/mcp/server", { body: input })
}

export async function patchMcpServer(input: {
  scope: AgentConfigScope
  name: string
  enabled?: boolean
  exposure?: McpExposure
}): Promise<void> {
  await request("PATCH /api/v1/platform/mcp/server", { body: input })
}

export async function deleteMcpServer(scope: AgentConfigScope, name: string): Promise<void> {
  await request("DELETE /api/v1/platform/mcp/server", { body: { scope, name } })
}

export function getMcpProbes(scope: AgentConfigScope): Promise<McpProbeReport> {
  return request("GET /api/v1/platform/mcp/probes", { query: { scope } })
}

export function probeMcp(scope: AgentConfigScope): Promise<McpProbeReport> {
  return request("POST /api/v1/platform/mcp/probe", { body: { scope } })
}

export function loginMcp(scope: AgentConfigScope, name: string): Promise<{ loginId: string }> {
  return request("POST /api/v1/platform/mcp/login", { body: { scope, name } })
}

export function openMcpLoginEvents(
  loginId: string,
  onEvent: (event: LoginEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return openLoginEvents(
    loginId,
    0,
    onEvent,
    signal,
    "GET /api/v1/platform/mcp/login/:loginId/events",
  )
}

export async function cancelMcpLogin(loginId: string): Promise<void> {
  await request("POST /api/v1/platform/mcp/login/:loginId/cancel", { params: { loginId } })
}

export async function logoutMcp(scope: AgentConfigScope, name: string): Promise<void> {
  await request("POST /api/v1/platform/mcp/logout", { body: { scope, name } })
}

export function getSkillScope(scope: AgentConfigScope): Promise<SkillScopeView> {
  return request("GET /api/v1/platform/skill-settings", { query: { scope } })
}

export function readSkill(scope: AgentConfigScope, path: string): Promise<SkillFileView> {
  return request("GET /api/v1/platform/skill-settings/file", { query: { scope, path } })
}

export function readSkillAsset(
  scope: AgentConfigScope,
  path: string,
  file: string,
): Promise<FileTextResponse> {
  return request("GET /api/v1/platform/skill-settings/asset", { query: { scope, path, file } })
}

export async function writeSkill(
  scope: AgentConfigScope,
  path: string,
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return request("PUT /api/v1/platform/skill-settings/file", { body: { scope, path, raw } })
}

export function createSkill(
  scope: AgentConfigScope,
  name: string,
  description: string,
): Promise<{ filePath: string } | { error: string }> {
  return request("POST /api/v1/platform/skill-settings", { body: { scope, name, description } })
}

export async function setSkillEnabled(
  scope: AgentConfigScope,
  filePath: string,
  enabled: boolean,
): Promise<void> {
  await request("PATCH /api/v1/platform/skill-settings/enabled", {
    body: { scope, filePath, enabled },
  })
}

export async function deleteSkill(scope: AgentConfigScope, path: string): Promise<void> {
  await request("DELETE /api/v1/platform/skill-settings", { body: { scope, path } })
}
