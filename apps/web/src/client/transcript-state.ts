import type { SessionSnapshot, TranscriptItem, TranscriptProgress } from "@pig/protocol"

export interface TranscriptState {
  readonly snapshot: SessionSnapshot
  readonly progressItems: ReadonlyMap<string, TranscriptItem>
  readonly progressOrder: readonly string[]
  readonly toolCallBuffers: ReadonlyMap<string, string>
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

function parsePartialInput(value: string): Json {
  try {
    return JSON.parse(value) as Json
  } catch {
    return value
  }
}

export function createTranscriptState(snapshot: SessionSnapshot): TranscriptState {
  return {
    snapshot: structuredClone(snapshot),
    progressItems: new Map(),
    progressOrder: [],
    toolCallBuffers: new Map(),
  }
}

export function applyTranscriptSnapshot(
  state: TranscriptState,
  snapshot: SessionSnapshot,
): TranscriptState {
  if (state.snapshot.id === snapshot.id && snapshot.revision < state.snapshot.revision) return state
  return createTranscriptState(snapshot)
}

function setProgressItem(state: TranscriptState, item: TranscriptItem): TranscriptState {
  const progressItems = new Map(state.progressItems)
  const progressOrder = progressItems.has(item.id)
    ? state.progressOrder
    : [...state.progressOrder, item.id]

  progressItems.set(item.id, structuredClone(item))
  return { ...state, progressItems, progressOrder }
}

export function applyTranscriptProgress(
  state: TranscriptState,
  progress: TranscriptProgress,
): TranscriptState {
  if (progress.type === "item_started" || progress.type === "item_updated")
    return setProgressItem(state, progress.item)

  if (progress.type === "item_finished") {
    const toolCallBuffers = new Map(state.toolCallBuffers)

    for (const key of toolCallBuffers.keys())
      if (key.startsWith(`${progress.item.id}:`)) toolCallBuffers.delete(key)
    return setProgressItem({ ...state, toolCallBuffers }, progress.item)
  }

  const item =
    state.progressItems.get(progress.messageId) ??
    state.snapshot.transcript.find(({ id }) => id === progress.messageId)

  if (!item || item.role !== "assistant") return state
  let toolCallBuffers = state.toolCallBuffers
  const content = item.content.map((part, index) => {
    if (index !== progress.contentIndex) return part

    if (progress.kind === "text" && part.type === "text")
      return { ...part, text: part.text + progress.delta }

    if (progress.kind === "thinking" && part.type === "thinking")
      return { ...part, thinking: part.thinking + progress.delta }

    if (progress.kind === "toolCall" && part.type === "toolCall") {
      const key = `${progress.messageId}:${progress.contentIndex}`
      const existing =
        state.toolCallBuffers.get(key) ?? (typeof part.input === "string" ? part.input : "")
      const buffer = existing + progress.delta
      toolCallBuffers = new Map(state.toolCallBuffers).set(key, buffer)
      return { ...part, input: parsePartialInput(buffer) }
    }

    return part
  })
  return setProgressItem({ ...state, toolCallBuffers }, { ...item, content })
}

export function selectTranscript(state: TranscriptState): readonly TranscriptItem[] {
  const transcript = state.snapshot.transcript.map(
    (item) => state.progressItems.get(item.id) ?? item,
  )
  const ids = new Set(transcript.map((item) => item.id))

  for (const id of state.progressOrder) {
    const item = state.progressItems.get(id)

    if (!ids.has(id) && item) {
      transcript.push(item)
      ids.add(id)
    }
  }

  for (const item of state.snapshot.queuedSteer) {
    if (ids.has(item.id)) continue
    transcript.push(item)
    ids.add(item.id)
  }

  return transcript
}
