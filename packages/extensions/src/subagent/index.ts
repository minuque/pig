import { posix } from "node:path"

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent"
import type { AgentTask, TaskDetails } from "@pig/protocol"
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.ts"
import { fromEntries } from "../remote-workspace/index.ts"
import { taskConfig } from "../tasks/config.ts"
import { registryFor } from "../tasks/registry.ts"
import { startChild as defaultStartChild, type ChildRun, type StartChild } from "./run.ts"

const MAX_TASKS = 8
const MAX_CONCURRENCY = 4
const RECENT_STEPS = 3

type Task = { agent: string; task: string; cwd?: string }

type Params = {
  agent?: string
  task?: string
  cwd?: string
  tasks?: Task[]
  chain?: Task[]
  agentScope?: AgentScope
  background?: boolean
}

/** 子任务的进展按 @pig/protocol 的 Task 形状产出；web 按它画卡片，TUI 读 content 文本。 */
export interface SubagentDetails extends TaskDetails {
  mode: "single" | "parallel" | "chain"
  tasks: AgentTask[]
}

type Ctx = Parameters<ToolDefinition["execute"]>[4]

type Update = Parameters<ToolDefinition["execute"]>[3]

const taskSchema = {
  type: "object",
  properties: {
    agent: { type: "string", description: "Name of the agent to invoke" },
    task: {
      type: "string",
      description: "Task to delegate. In chain mode {previous} is the prior output",
    },
    cwd: { type: "string", description: "Working directory for the subagent" },
  },
  required: ["agent", "task"],
}
const parameters = {
  type: "object",
  properties: {
    agent: { type: "string", description: "Agent name (single mode)" },
    task: { type: "string", description: "Task to delegate (single mode)" },
    cwd: { type: "string", description: "Working directory (single mode)" },
    tasks: {
      type: "array",
      items: taskSchema,
      description: `Run in parallel, at most ${MAX_TASKS}`,
    },
    chain: { type: "array", items: taskSchema, description: "Run one after another" },
    agentScope: {
      type: "string",
      enum: ["user", "project", "both"],
      description: 'Which agent directories to use. Default "user"; "both" adds project agents',
    },
    background: {
      type: "boolean",
      description:
        "Return task ids immediately and run in the background; you are notified as each task finishes. Not for chain mode",
    },
  },
}

/** 按并发上限跑完一组任务，结果顺序与输入一致。 */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await run(items[index] as T, index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function resolveModel(ctx: Ctx, wanted: string | undefined): ChildRun["model"] {
  if (!wanted) return ctx.model
  const [provider, id] = wanted.includes("/") ? wanted.split("/", 2) : [undefined, wanted]
  const found = provider
    ? ctx.modelRegistry.find(provider, id as string)
    : ctx.modelRegistry.getAvailable().find((model) => model.id === id)
  return found ?? ctx.model
}

function summary(details: SubagentDetails): string {
  return details.tasks
    .map((item) => {
      const head = `[${item.description}] ${item.status}`
      return item.summary
        ? `${head}\n${item.summary}`
        : item.error
          ? `${head}: ${item.error}`
          : head
    })
    .join("\n\n")
}

/** subagent 工具：单个、并行、串联三种派法；子任务在同一进程里开子会话。 */
export function createSubagentTool(deps: { startChild?: StartChild } = {}): ToolDefinition {
  const startChild = deps.startChild ?? defaultStartChild
  return {
    name: "subagent",
    label: "Subagent",
    description: [
      "Delegate tasks to specialized subagents, each with an isolated context.",
      "Modes: single (agent + task), parallel (tasks), chain (sequential, {previous} = prior output).",
      "Agents come from the agents directory under the pi config, and .pi/agents in the project.",
    ].join(" "),
    parameters: parameters as never,
    async execute(toolCallId, rawParams, toolSignal, onUpdate: Update, ctx: Ctx) {
      const params = rawParams as Params
      const agents = discoverAgents(ctx.cwd, params.agentScope ?? "user").agents
      const mode: SubagentDetails["mode"] = params.chain?.length
        ? "chain"
        : params.tasks?.length
          ? "parallel"
          : "single"
      const tasks: Task[] =
        params.chain ??
        params.tasks ??
        (params.agent && params.task
          ? [{ agent: params.agent, task: params.task, ...(params.cwd ? { cwd: params.cwd } : {}) }]
          : [])
      const details: SubagentDetails = {
        mode,
        tasks: tasks.map((task, index) => ({
          id: `agent:${toolCallId}:${index}`,
          kind: "agent",
          description: task.agent,
          prompt: task.task,
          status: "queued",
          steps: [],
          tokens: 0,
        })),
      }
      const reply = (text: string) => ({ content: [{ type: "text" as const, text }], details })

      if (tasks.length === 0) {
        const names = agents.map((agent) => agent.name).join(", ") || "none"
        return reply(`Provide agent + task, tasks, or chain. Available agents: ${names}`)
      }

      if (tasks.length > MAX_TASKS)
        return reply(`Too many tasks (${tasks.length}). At most ${MAX_TASKS} per call.`)

      const publishAll = () =>
        onUpdate?.({
          content: [{ type: "text", text: summary(details) }],
          details: structuredClone(details),
        })
      const runOne = async (
        task: Task,
        index: number,
        previous = "",
        signal = toolSignal,
        publish = publishAll,
      ) => {
        const result = details.tasks[index] as AgentTask
        const agent: AgentConfig | undefined = agents.find((item) => item.name === task.agent)

        if (signal?.aborted) {
          result.status = "stopped"
          return ""
        }

        if (!agent) {
          result.status = "failed"
          result.error = `Unknown agent: ${task.agent}`
          publish()
          return ""
        }

        result.status = "running"
        result.startedAt = Date.now()
        publish()

        // 远程会话里 cwd 是远端路径：改的是绑定目录，本地仍用父会话的占位目录
        const parent = fromEntries(ctx)
        const remote =
          parent && task.cwd ? { ...parent, path: posix.resolve(parent.path, task.cwd) } : parent

        try {
          const done = await startChild({
            agent,
            task: task.task.replaceAll("{previous}", previous),
            cwd: parent ? ctx.cwd : (task.cwd ?? ctx.cwd),
            model: resolveModel(ctx, agent.model),
            thinkingLevel: ctx.thinkingLevel,
            parentSessionFile: ctx.sessionManager.getSessionFile(),
            remote,
            sessionDir: ctx.sessionManager.getSessionDir(),
            signal,
            onSession: (sessionId) => {
              result.sessionId = sessionId
              publish()
            },
            onStep: (step) => {
              result.steps = [...result.steps, step].slice(-RECENT_STEPS)
              publish()
            },
          })

          result.status = signal?.aborted ? "stopped" : "completed"
          result.summary = done.output
          result.tokens = done.usage.input + done.usage.output
          return done.output
        } catch (error) {
          // 子任务失败只记在自己的结果里，不冒到主会话
          result.status = signal?.aborted ? "stopped" : "failed"
          result.error = error instanceof Error ? error.message : String(error)
          return ""
        } finally {
          publish()
        }
      }

      if (params.background) {
        if (mode === "chain") return reply("Chain mode cannot run in the background.")
        const registry = registryFor(ctx.sessionManager.getSessionId())

        if (registry.runningCount() + tasks.length > taskConfig.maxRunning)
          return reply(
            `Too many background tasks running (limit ${taskConfig.maxRunning}). Stop one with bg_task_stop or wait for one to finish.`,
          )
        const controllers = tasks.map(() => new AbortController())
        details.tasks.forEach((item, index) =>
          registry.add(structuredClone(item), () => controllers[index]?.abort()),
        )
        // 不等子任务：工具调用先返回，每个子任务结束时由登记表通知会话
        void mapLimited(tasks, MAX_CONCURRENCY, async (task, index) => {
          const item = details.tasks[index] as AgentTask
          const signal = (controllers[index] as AbortController).signal
          // 结束只走 finish，进行中的更新不能把任务改成已结束
          const progress = () => {
            if (item.status === "running") registry.patch(item.id, { ...item })
          }

          await runOne(task, index, "", signal, progress)
          registry.finish(item.id, { ...item }, item.status !== "stopped")
        })
        const ids = details.tasks.map((item) => item.id).join(", ")
        return reply(`Started background tasks ${ids}. You will be notified as each finishes.`)
      }

      if (mode === "chain") {
        let previous = ""

        for (const [index, task] of tasks.entries()) {
          previous = await runOne(task, index, previous)

          if (details.tasks[index]?.status !== "completed") break
        }
      } else {
        await mapLimited(tasks, MAX_CONCURRENCY, (task, index) => runOne(task, index))
      }

      return reply(summary(details))
    },
  }
}

export default function subagent(pi: ExtensionAPI) {
  pi.registerTool(createSubagentTool())
}
