import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent"
import { BINDING_ENTRY, type RemoteBinding } from "@pig/environment/source"

import remoteWorkspace from "../remote-workspace/index.ts"
import type { AgentConfig } from "./agents.ts"

/** 子会话文件里的标记：会话列表据此把子会话与普通分叉区分开。 */
export const SUBAGENT_ENTRY = "pig.subagent"

type Model = NonNullable<Parameters<typeof createAgentSession>[0]>["model"]

type ThinkingLevel = NonNullable<Parameters<typeof createAgentSession>[0]>["thinkingLevel"]

export interface ChildRun {
  agent: AgentConfig
  task: string
  cwd: string
  model: Model
  thinkingLevel: ThinkingLevel
  /** 父会话文件与会话目录：子会话落盘在同一目录，并记下父会话。 */
  parentSessionFile: string | undefined
  sessionDir: string
  /** 父会话绑定的远程 workspace：子会话的工具也在那里跑。 */
  remote: RemoteBinding | undefined
  signal: AbortSignal | undefined
  onSession(sessionId: string): void
  onStep(step: string): void
}

export interface ChildResult {
  output: string
  usage: { input: number; output: number; cost: number }
}

/** 开一个子会话跑完一个任务；可替换，测试用它注入替身。 */
export type StartChild = (run: ChildRun) => Promise<ChildResult>

let runtime: Promise<ModelRuntime> | undefined

/** 子会话共用一份模型运行时（公开 API 拿不到宿主的那份，只能自建一次）。 */
function sharedRuntime() {
  runtime ??= ModelRuntime.create({ allowModelNetwork: false })
  return runtime
}

const brief = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "")
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

/** 一步工具调用的单行摘要，给卡片与 TUI 显示最近进展。 */
function stepOf(event: Extract<AgentSessionEvent, { type: "tool_execution_start" }>): string {
  const args = event.args as Record<string, unknown> | undefined
  const target = args?.path ?? args?.command ?? args?.pattern ?? args
  return `${event.toolName} ${brief(target)}`
}

/**
 * 在同一进程里开子会话：不加载用户扩展（避免子任务再派子任务），系统提示追加 agent 定义。
 * 父会话在远程时只带上 remote-workspace，让子任务的工具也走同一环境。
 */
export const startChild: StartChild = async (run) => {
  const loader = new DefaultResourceLoader({
    cwd: run.cwd,
    agentDir: getAgentDir(),
    noExtensions: true,
    ...(run.remote ? { extensionFactories: [remoteWorkspace] } : {}),
    ...(run.agent.systemPrompt ? { appendSystemPrompt: [run.agent.systemPrompt] } : {}),
  })

  await loader.reload()

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
    await session.prompt(run.task)
    await session.waitForIdle()
    return { output, usage }
  } finally {
    run.signal?.removeEventListener("abort", abort)
    unsubscribe()
    session.dispose()
  }
}
