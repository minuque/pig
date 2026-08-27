/**
 * 具名 platform HTTP API。路径字符串只出现在本文件。
 */
import { platformRequest } from "@client/http.js"

export interface SessionCard {
  id: string
  messageCount: number
  model?: { provider: string; id: string }
}

export interface ContextUsageEstimate {
  used: number
  window: number
  segments: {
    systemPrompt: number
    memory: number
    skills: number
    tools: number
    toolResults: number
    conversation: number
    other: number
    idle: number
  }
}

export async function selectDirectory(
  path?: string,
): Promise<{ path: string | null; requiresManualInput: boolean }> {
  const result = await platformRequest<{
    path: string | null
    requiresManualInput?: boolean
  }>(
    "/api/v1/platform/select-directory",
    path === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify({ path }) },
  )
  return {
    path: result.path,
    requiresManualInput: Boolean(result.requiresManualInput),
  }
}

export async function listSessionCards(): Promise<SessionCard[]> {
  const result = await platformRequest<{ cards: SessionCard[] }>("/api/v1/platform/session-cards")
  return result.cards
}

export async function contextUsage(sessionId: string): Promise<ContextUsageEstimate | null> {
  const result = await platformRequest<{ usage: ContextUsageEstimate | null }>(
    `/api/v1/platform/context-usage?sessionId=${encodeURIComponent(sessionId)}`,
  )
  return result.usage
}

export async function contextPreview(
  sessionId: string,
  segmentId: string,
): Promise<{ title: string; content: string } | null> {
  const result = await platformRequest<{
    preview: { title: string; content: string } | null
  }>(
    `/api/v1/platform/context-usage?sessionId=${encodeURIComponent(sessionId)}&preview=${encodeURIComponent(segmentId)}`,
  )
  return result.preview
}

export async function renameSession(id: string, name: string): Promise<void> {
  await platformRequest("/api/v1/platform/rename-session", {
    method: "POST",
    body: JSON.stringify({ id, name }),
  })
}

export async function deleteSession(id: string): Promise<void> {
  await platformRequest("/api/v1/platform/delete-session", {
    method: "POST",
    body: JSON.stringify({ id }),
  })
}
