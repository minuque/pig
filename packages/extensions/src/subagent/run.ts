import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent"
import { BINDING_ENTRY, type RemoteBinding } from "@pig/environment/source"

import remoteWorkspace from "../remote-workspace/index.ts"
import type { AgentConfig } from "./agents.ts"

import { SUBAGENT_ENTRY } from "@pig/protocol"

export { SUBAGENT_ENTRY }

type Model = NonNullable<Parameters<typeof createAgentSession>[0]>["model"]

type ThinkingLevel = NonNullable<Parameters<typeof createAgentSession>[0]>["thinkingLevel"]

export interface ChildRun {
  agent: AgentConfig
  task: string
  cwd: string
  model: Model
  thinkingLevel: ThinkingLevel
  parentSessionFile: string | undefined
  sessionDir: string
  remote: RemoteBinding | undefined
  signal: AbortSignal | undefined
  onSession(sessionId: string): void
  onStep(step: string): void
}

export interface ChildResult {
  output: string
  usage: { input: number; output: number; cost: number }
}

export type StartChild = (run: ChildRun) => Promise<ChildResult>

let runtime: Promise<ModelRuntime> | undefined

/** 子会话共用一份模型运行时（公开 API 拿不到宿主的那份，只能自建一次）。 */
function sharedRuntime() {
  runtime ??= ModelRuntime.create({ allowModelNetwork: false })
  return runtime
}

export function resetSharedRuntime(): void {
  runtime = undefined
}

const brief = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "")
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

function stepOf(event: Extract<AgentSessionEvent, { type: "tool_execution_start" }>): string {
  const args = event.args as Record<string, unknown> | undefined
  const target = args?.path ?? args?.command ?? args?.pattern ?? args
  return `${event.toolName} ${brief(target)}`
}

function settingsWithoutPackages(cwd: string, agentDir: string): SettingsManager {
  const settings = SettingsManager.create(cwd, agentDir)
  const global = settings.getGlobalSettings.bind(settings)
  const project = settings.getProjectSettings.bind(settings)
  settings.getGlobalSettings = () => ({ ...global(), packages: [] })
  settings.getProjectSettings = () => ({ ...project(), packages: [] })
  return settings
}

export async function childResourceLoader(
  run: Pick<ChildRun, "cwd" | "remote" | "agent">,
): Promise<DefaultResourceLoader> {
  const agentDir = getAgentDir()
  const loader = new DefaultResourceLoader({
    cwd: run.cwd,
    agentDir,
    settingsManager: settingsWithoutPackages(run.cwd, agentDir),
    noExtensions: true,
    ...(run.remote ? { extensionFactories: [remoteWorkspace] } : {}),
    ...(run.agent.systemPrompt ? { appendSystemPrompt: [run.agent.systemPrompt] } : {}),
  })

  await loader.reload()
  return loader
}

/**
 * 在同一进程里开子会话：不加载用户扩展（避免子任务再派子任务），系统提示追加 agent 定义。
 * 父会话在远程时只带上 remote-workspace，让子任务的工具也走同一环境。
 */
export const startChild: StartChild = async (run) => {
  const loader = await childResourceLoader(run)
  const sessionManager = SessionManager.create(
    run.cwd,
    run.sessionDir,
    run.parentSessionFile ? { parentSession: run.parentSessionFile } : {},
  )

  sessionManager.appendCustomEntry(SUBAGENT_ENTRY, { agent: run.agent.name })

  if (run.remote) sessionManager.appendCustomEntry(BINDING_ENTRY, run.remote)

  const { session } = await createAgentSession({
    cwd: run.cwd,
    modelRuntime: await sharedRuntime(),
    resourceLoader: loader,
    sessionManager,
    ...(run.model ? { model: run.model } : {}),
    ...(run.thinkingLevel ? { thinkingLevel: run.thinkingLevel } : {}),
    ...(run.agent.tools ? { tools: run.agent.tools } : {}),
  })

  if (run.remote) await session.bindExtensions({})
  run.onSession(session.sessionId)
  const usage = { input: 0, output: 0, cost: 0 }
  let output = ""
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "tool_execution_start") run.onStep(stepOf(event))

    if (event.type !== "message_end" || event.message.role !== "assistant") return
    usage.input += event.message.usage.input
    usage.output += event.message.usage.output
    usage.cost += event.message.usage.cost.total

    const text = event.message.content
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("")

    if (text) output = text
  })
  const abort = () => void session.abort()
  run.signal?.addEventListener("abort", abort, { once: true })

  try {
    if (run.signal?.aborted) throw new Error("Subagent aborted")
    await session.prompt(run.task)
    await session.waitForIdle()
    return { output, usage }
  } finally {
    run.signal?.removeEventListener("abort", abort)
    unsubscribe()
    session.dispose()
  }
}
