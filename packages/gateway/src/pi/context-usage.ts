import { estimateTokens, formatSkillsForPrompt, type Skill } from "@earendil-works/pi-coding-agent"

export const CONTEXT_PREVIEW_KEYS = [
  "systemPrompt",
  "memory",
  "skills",
  "tools",
  "toolResults",
  "conversation",
] as const

export type ContextPreviewKey = (typeof CONTEXT_PREVIEW_KEYS)[number]

export interface ContextUsagePreview {
  key: ContextPreviewKey
  title: string
  content: string
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
  preview?: ContextUsagePreview
}

const PREVIEW_META: Record<ContextPreviewKey, { title: string; empty: string }> = {
  systemPrompt: { title: "系统提示词", empty: "无系统提示词。" },
  memory: { title: "记忆", empty: "当前上下文没有记忆文件。" },
  skills: { title: "Skills", empty: "当前上下文没有 Skills。" },
  tools: { title: "Tool 定义", empty: "没有启用的 Tool 定义。" },
  toolResults: { title: "Tool 结果", empty: "当前上下文没有 Tool 结果。" },
  conversation: { title: "当前会话上下文", empty: "没有会话上下文。" },
}

interface ContextUsageSource {
  systemPrompt: string
  model: { contextWindow?: number } | undefined
  getContextUsage():
    { tokens: number | null; contextWindow: number; percent: number | null } | undefined
  getActiveToolNames(): string[]
  getAllTools(): Array<{
    name: string
    description: string
    parameters: unknown
  }>
  sessionManager: { buildContextEntries(): unknown[] }
  resourceLoader: {
    getAgentsFiles(): { agentsFiles: Array<{ path: string; content: string }> }
    getSkills(): { skills: Skill[] }
  }
}

export function isContextPreviewKey(value: string | null): value is ContextPreviewKey {
  return CONTEXT_PREVIEW_KEYS.includes(value as ContextPreviewKey)
}

function estimateText(value: unknown): number {
  if (!value) return 0
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return Math.max(0, Math.ceil(text.length / 4))
}

function previewValue(value: unknown): string {
  if (typeof value === "string") return value
  return JSON.stringify(value, null, 2)
}

function finishPreview(key: ContextPreviewKey, chunks: string[]): ContextUsagePreview {
  return {
    key,
    title: PREVIEW_META[key].title,
    content: chunks.join("\n\n") || PREVIEW_META[key].empty,
  }
}

/** 只统计确实嵌进 system prompt 的片段，避免源文件预览把占用加两遍。 */
function embeddedTokens(prompt: string, chunk: string): number {
  if (!chunk || !prompt.includes(chunk)) return 0
  return estimateText(chunk)
}

function collectTools(
  source: ContextUsageSource,
  preview: boolean,
): { tokens: number; chunks: string[] } {
  const active = new Set(source.getActiveToolNames())
  let tokens = 0
  const chunks: string[] = []
  for (const tool of source.getAllTools()) {
    if (!active.has(tool.name)) continue
    const definition = {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }
    tokens += estimateText(definition)
    if (preview) chunks.push(`## Definition: ${tool.name}\n\n${previewValue(definition)}`)
  }
  return { tokens, chunks }
}

function walkEntries(
  entries: unknown[],
  preview: ContextPreviewKey | undefined,
): { toolResults: number; conversation: number; toolChunks: string[]; contextChunks: string[] } {
  let toolResults = 0
  let conversation = 0
  const toolChunks: string[] = []
  const contextChunks: string[] = []
  const wantTools = preview === "toolResults"
  const wantContext = preview === "conversation"
  for (const raw of entries) {
    const entry = raw as {
      type?: string
      summary?: string
      content?: unknown
      customType?: string
      message?: {
        role?: string
        content?: unknown
        toolName?: string
        command?: unknown
        output?: unknown
      }
    }
    if (entry.type === "message") {
      const message = entry.message
      if (!message) continue
      if (message.role === "assistant" && Array.isArray(message.content)) {
        for (const block of message.content as Array<{
          type?: string
          name?: unknown
          arguments?: unknown
          text?: string
          thinking?: string
        }>) {
          if (block.type === "toolCall") {
            conversation += estimateText(block.name) + estimateText(block.arguments)
            if (wantContext) {
              contextChunks.push(
                `## Assistant tool call: ${String(block.name)}\n\n${previewValue(block.arguments)}`,
              )
            }
          } else if (block.type === "text") {
            conversation += estimateText(block.text)
            if (wantContext && block.text) contextChunks.push(`## Assistant\n\n${block.text}`)
          } else if (block.type === "thinking") {
            conversation += estimateText(block.thinking)
            if (wantContext && block.thinking) {
              contextChunks.push(`## Assistant thinking\n\n${block.thinking}`)
            }
          }
        }
      } else if (message.role === "toolResult") {
        toolResults += estimateTokens(message as Parameters<typeof estimateTokens>[0])
        if (wantTools) {
          toolChunks.push(`## Result: ${message.toolName}\n\n${previewValue(message.content)}`)
        }
      } else if (message.role === "bashExecution") {
        toolResults += estimateTokens(message as Parameters<typeof estimateTokens>[0])
        if (wantTools) {
          toolChunks.push(
            `## Bash\n\nCommand:\n\n${previewValue(message.command)}\n\nOutput:\n\n${previewValue(message.output)}`,
          )
        }
      } else {
        conversation += estimateTokens(message as Parameters<typeof estimateTokens>[0])
        if (wantContext) {
          contextChunks.push(`## ${message.role}\n\n${previewValue(message.content)}`)
        }
      }
    } else if (entry.type === "compaction" || entry.type === "branch_summary") {
      conversation += estimateText(entry.summary)
      if (wantContext && entry.summary) {
        contextChunks.push(
          `## ${entry.type === "compaction" ? "Compaction" : "Branch summary"}\n\n${entry.summary}`,
        )
      }
    } else if (entry.type === "custom_message") {
      conversation += estimateText(entry.content)
      if (wantContext) {
        contextChunks.push(`## Custom: ${entry.customType}\n\n${previewValue(entry.content)}`)
      }
    }
  }
  return { toolResults, conversation, toolChunks, contextChunks }
}

function capVariable(
  raw: { toolResults: number; conversation: number },
  budget: number,
): { toolResults: number; conversation: number } {
  const estimated = raw.toolResults + raw.conversation
  if (estimated <= budget || estimated === 0) return raw
  if (budget === 0) return { toolResults: 0, conversation: 0 }
  const toolResults = Math.round((raw.toolResults / estimated) * budget)
  return { toolResults, conversation: budget - toolResults }
}

export function resolveUsedTokens(
  usage: { tokens: number | null; percent: number | null } | undefined,
  estimated: number,
  contextWindow: number,
): number {
  const reported = usage?.tokens
  const fromPercent =
    usage?.percent !== null && usage?.percent !== undefined && contextWindow > 0
      ? Math.round((usage.percent / 100) * contextWindow)
      : undefined
  let resolved = reported ?? fromPercent ?? estimated
  if (reported !== null && reported !== undefined && fromPercent !== undefined) {
    const tolerance = Math.max(32, Math.round(contextWindow * 0.001))
    if (Math.abs(reported - fromPercent) > tolerance) resolved = fromPercent
  }
  if (estimated > 0 && resolved < estimated * 0.25) resolved = estimated
  return Math.max(0, Math.round(resolved))
}

/**
 * 以 Pi 的总占用校准分段。System / Memory / Skills / Tools definition
 * 是固定项；Tool results 与会话上下文按比例压缩；差额归入「其他」。
 */
export function estimateContextUsage(
  source: ContextUsageSource,
  previewKey?: ContextPreviewKey,
): ContextUsageEstimate {
  const prompt = source.systemPrompt
  let memory = 0
  const memoryChunks: string[] = []
  for (const file of source.resourceLoader.getAgentsFiles().agentsFiles) {
    memory += embeddedTokens(prompt, file.content)
    if (previewKey === "memory")
      memoryChunks.push(`## ${file.path}\n\n${previewValue(file.content)}`)
  }
  const skillsText = formatSkillsForPrompt(source.resourceLoader.getSkills().skills ?? []).trim()
  const skills = embeddedTokens(prompt, skillsText)
  const systemPrompt = Math.max(0, estimateText(prompt) - memory - skills)
  const tools = collectTools(source, previewKey === "tools")
  const walked = walkEntries(source.sessionManager.buildContextEntries(), previewKey)
  const known =
    systemPrompt + memory + skills + tools.tokens + walked.toolResults + walked.conversation
  const reported = source.getContextUsage()
  const window = Math.max(0, reported?.contextWindow ?? source.model?.contextWindow ?? 0)
  const fixed = systemPrompt + memory + skills + tools.tokens
  const used = Math.max(resolveUsedTokens(reported, known, window), fixed)
  const fitted = capVariable(walked, Math.max(0, used - fixed))
  const attributed = fixed + fitted.toolResults + fitted.conversation

  const estimate: ContextUsageEstimate = {
    used,
    window,
    segments: {
      systemPrompt,
      memory,
      skills,
      tools: tools.tokens,
      ...fitted,
      other: Math.max(0, used - attributed),
      idle: Math.max(0, window - used),
    },
  }
  if (!previewKey) return estimate
  const preview =
    previewKey === "systemPrompt"
      ? finishPreview("systemPrompt", prompt ? [prompt] : [])
      : previewKey === "memory"
        ? finishPreview("memory", memoryChunks)
        : previewKey === "skills"
          ? finishPreview("skills", skillsText ? [skillsText] : [])
          : previewKey === "tools"
            ? finishPreview("tools", tools.chunks)
            : previewKey === "toolResults"
              ? finishPreview("toolResults", walked.toolChunks)
              : finishPreview("conversation", walked.contextChunks)
  return { ...estimate, preview }
}
