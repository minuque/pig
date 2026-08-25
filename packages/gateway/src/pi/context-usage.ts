import { estimateTokens, formatSkillsForPrompt, type Skill } from "@earendil-works/pi-coding-agent"

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

function estimateText(value: unknown): number {
  if (!value) return 0
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return Math.max(0, Math.ceil(text.length / 4))
}

/** 只统计确实嵌进 system prompt 的片段，避免源文件预览把占用加两遍。 */
function embeddedTokens(prompt: string, chunk: string): number {
  if (!chunk || !prompt.includes(chunk)) return 0
  return estimateText(chunk)
}

function estimateTools(source: ContextUsageSource): number {
  const active = new Set(source.getActiveToolNames())
  let tokens = 0
  for (const tool of source.getAllTools()) {
    if (!active.has(tool.name)) continue
    tokens += estimateText({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })
  }
  return tokens
}

function walkEntries(entries: unknown[]): { toolResults: number; conversation: number } {
  let toolResults = 0
  let conversation = 0
  for (const raw of entries) {
    const entry = raw as {
      type?: string
      summary?: string
      content?: unknown
      message?: {
        role?: string
        content?: unknown
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
          } else if (block.type === "text") {
            conversation += estimateText(block.text)
          } else if (block.type === "thinking") {
            conversation += estimateText(block.thinking)
          }
        }
      } else if (message.role === "toolResult" || message.role === "bashExecution") {
        toolResults += estimateTokens(message as Parameters<typeof estimateTokens>[0])
      } else {
        conversation += estimateTokens(message as Parameters<typeof estimateTokens>[0])
      }
    } else if (entry.type === "compaction" || entry.type === "branch_summary") {
      conversation += estimateText(entry.summary)
    } else if (entry.type === "custom_message") {
      conversation += estimateText(entry.content)
    }
  }
  return { toolResults, conversation }
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
export function estimateContextUsage(source: ContextUsageSource): ContextUsageEstimate {
  const prompt = source.systemPrompt
  let memory = 0
  for (const file of source.resourceLoader.getAgentsFiles().agentsFiles) {
    memory += embeddedTokens(prompt, file.content)
  }
  const skillsText = formatSkillsForPrompt(source.resourceLoader.getSkills().skills ?? []).trim()
  const skills = embeddedTokens(prompt, skillsText)
  const systemPrompt = Math.max(0, estimateText(prompt) - memory - skills)
  const tools = estimateTools(source)
  const walked = walkEntries(source.sessionManager.buildContextEntries())
  const known = systemPrompt + memory + skills + tools + walked.toolResults + walked.conversation
  const reported = source.getContextUsage()
  const window = Math.max(0, reported?.contextWindow ?? source.model?.contextWindow ?? 0)
  const fixed = systemPrompt + memory + skills + tools
  const used = Math.max(resolveUsedTokens(reported, known, window), fixed)
  const fitted = capVariable(walked, Math.max(0, used - fixed))
  const attributed = fixed + fitted.toolResults + fitted.conversation

  return {
    used,
    window,
    segments: {
      systemPrompt,
      memory,
      skills,
      tools,
      ...fitted,
      other: Math.max(0, used - attributed),
      idle: Math.max(0, window - used),
    },
  }
}
