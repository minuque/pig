/**
 * 具名 platform HTTP API。路径字符串只出现在本文件。
 */
import { platformRequest } from "@client/http.js"
import type { TranscriptItem } from "@/types/common-type.js"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import type { SessionCard } from "@/types/session-type.js"
import type { TurnTiming } from "@/types/turn-type.js"

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

function isTurnTiming(value: unknown): value is TurnTiming {
  if (
    !value ||
    typeof value !== "object" ||
    !("userId" in value) ||
    typeof value.userId !== "string" ||
    !("startedAt" in value) ||
    typeof value.startedAt !== "number" ||
    !Number.isFinite(value.startedAt) ||
    !("outcome" in value)
  )
    return false
  if (value.outcome === "running") return !("endedAt" in value)
  return (
    (value.outcome === "complete" || value.outcome === "error" || value.outcome === "aborted") &&
    "endedAt" in value &&
    typeof value.endedAt === "number" &&
    Number.isFinite(value.endedAt) &&
    value.endedAt >= value.startedAt
  )
}

export async function sessionTranscript(
  sessionId: string,
  before?: string,
): Promise<{ items: TranscriptItem[]; timings: TurnTiming[]; hasMore: boolean }> {
  const query = new URLSearchParams({ sessionId })
  if (before) query.set("before", before)
  const result = await platformRequest<{
    items: TranscriptItem[]
    timings?: unknown[]
    hasMore?: boolean
  }>(`/api/v1/platform/transcript?${query.toString()}`)
  return {
    items: Array.isArray(result.items) ? result.items : [],
    timings: Array.isArray(result.timings) ? result.timings.filter(isTurnTiming) : [],
    hasMore: Boolean(result.hasMore),
  }
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
