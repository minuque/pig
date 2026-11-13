import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createSubagentTool, type SubagentDetails } from "../src/subagent/index.ts"
import type { Task } from "@pig/protocol"
import type { ChildRun, StartChild } from "../src/subagent/run.ts"
import { dropRegistry, registryFor } from "../src/tasks/registry.ts"

let root: string
const previousAgentDir = process.env.PI_CODING_AGENT_DIR

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pig-subagent-"))
  process.env.PI_CODING_AGENT_DIR = root
  await mkdir(join(root, "agents"))

  for (const name of ["scout", "planner", "reviewer"])
    await writeFile(
      join(root, "agents", `${name}.md`),
      `---\nname: ${name}\ndescription: ${name}\n---\n你是 ${name}。`,
    )
})

afterEach(async () => {
  process.env.PI_CODING_AGENT_DIR = previousAgentDir
  await rm(root, { recursive: true, force: true })
})

/** 父会话的上下文替身：只给子任务用得到的字段。 */
const ctx = (entries: unknown[] = []) =>
  ({
    cwd: root,
    model: undefined,
    thinkingLevel: undefined,
    sessionManager: {
      getSessionFile: () => join(root, "parent.jsonl"),
      getSessionDir: () => root,
      getSessionId: () => "parent",
      getEntries: () => entries,
    },
    modelRegistry: { find: () => undefined, getAvailable: () => [] },
  }) as never

type Update = { details: SubagentDetails }

async function run(
  params: Record<string, unknown>,
  startChild: StartChild,
  signal?: AbortSignal,
  entries?: unknown[],
) {
  const updates: Update[] = []
  const tool = createSubagentTool({ startChild })
  const result = await tool.execute(
    "call-1",
    params as never,
    signal,
    (update) => {
      updates.push(update as Update)
    },
    ctx(entries),
  )
  return { result: result as Update & { content: Array<{ text: string }> }, updates }
}

describe("subagent：派子任务、并行、中止", () => {
  it("并行 3 个子任务都跑完，结果里有每个子任务的状态、输出与子会话 id", async () => {
    let live = 0
    let peak = 0
    const startChild: StartChild = async (child: ChildRun) => {
      live += 1
      peak = Math.max(peak, live)
      child.onSession(`child-${child.agent.name}`)
      child.onStep(`read ${child.agent.name}.ts`)
      await new Promise((resolve) => setTimeout(resolve, 10))
      live -= 1
      return { output: `${child.agent.name} 完成`, usage: { input: 1, output: 2, cost: 0 } }
    }
    const { result, updates } = await run(
      {
        tasks: [
          { agent: "scout", task: "看协议" },
          { agent: "planner", task: "出方案" },
          { agent: "reviewer", task: "审" },
        ],
      },
      startChild,
    )

    expect(result.details.mode).toBe("parallel")
    expect(
      result.details.tasks.map((item) => [item.id, item.description, item.status, item.sessionId]),
    ).toEqual([
      ["agent:call-1:0", "scout", "completed", "child-scout"],
      ["agent:call-1:1", "planner", "completed", "child-planner"],
      ["agent:call-1:2", "reviewer", "completed", "child-reviewer"],
    ])
    expect(result.details.tasks[0]).toMatchObject({
      kind: "agent",
      prompt: "看协议",
      summary: "scout 完成",
      tokens: 3,
    })
    expect(peak).toBeLessThanOrEqual(4)
    // 卡片实时进度：跑的过程中有「运行中 + 最近一步」的更新
    expect(
      updates.some((update) =>
        update.details.tasks.some(
          (item) => item.status === "running" && item.steps.includes("read scout.ts"),
        ),
      ),
    ).toBe(true)
  })

  it("一次超过 8 个任务直接拒绝，不启动任何子任务", async () => {
    let started = 0
    const { result } = await run(
      { tasks: Array.from({ length: 9 }, () => ({ agent: "scout", task: "x" })) },
      async () => {
        started += 1
        return { output: "", usage: { input: 0, output: 0, cost: 0 } }
      },
    )

    expect(started).toBe(0)
    expect(result.content[0]?.text).toContain("8")
  })

  it("中止主会话：所有在跑的子任务收到中止，状态记为 stopped", async () => {
    const controller = new AbortController()
    const startChild: StartChild = (child) =>
      new Promise((_resolve, reject) => {
        child.onSession(`child-${child.agent.name}`)
        child.signal?.addEventListener("abort", () => reject(new Error("aborted")))
      })
    const pending = run(
      {
        tasks: [
          { agent: "scout", task: "a" },
          { agent: "planner", task: "b" },
        ],
      },
      startChild,
      controller.signal,
    )

    await new Promise((resolve) => setTimeout(resolve, 5))
    controller.abort()
    const { result } = await pending

    expect(result.details.tasks.map((item) => item.status)).toEqual(["stopped", "stopped"])
  })

  it("远程会话：子任务给的 cwd 是远端目录，本地仍用父会话的占位目录", async () => {
    const runs: ChildRun[] = []
    const startChild: StartChild = async (child) => {
      runs.push(child)
      return { output: "", usage: { input: 0, output: 0, cost: 0 } }
    }
    const binding = { environment: "ssh://devbox", path: "/srv/app" }
    const entries = [{ type: "custom", customType: "pig.remote", data: binding }]

    await run({ agent: "scout", task: "a", cwd: "packages/api" }, startChild, undefined, entries)
    await run({ agent: "scout", task: "b" }, startChild, undefined, entries)

    expect(runs.map((child) => [child.cwd, child.remote])).toEqual([
      [root, { environment: "ssh://devbox", path: "/srv/app/packages/api" }],
      [root, binding],
    ])
  })
})

describe("subagent：后台派出", () => {
  afterEach(() => dropRegistry("parent"))

  /** 接住登记表发出的任务列表与结束通知。 */
  const host = () => {
    const published: Task[][] = []
    const notified: Array<{ task: Task; wake: boolean }> = []
    registryFor("parent").bind({
      publish: (tasks) => published.push(tasks),
      notify: (task, wake) => notified.push({ task, wake }),
    })
    return { published, notified }
  }

  it("工具调用立刻返回 task id；子任务进登记表，跑完后叫醒模型", async () => {
    const { published, notified } = host()
    let finish: (value: Awaited<ReturnType<StartChild>>) => void = () => undefined
    const startChild: StartChild = (child) => {
      child.onSession("child-scout")
      return new Promise((resolve) => (finish = resolve))
    }
    const { result } = await run({ agent: "scout", task: "看协议", background: true }, startChild)

    expect(result.content[0]!.text).toContain("agent:call-1:0")
    // 登记表把进行中的更新合并后再发
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(published.at(-1)?.[0]).toMatchObject({
      id: "agent:call-1:0",
      kind: "agent",
      status: "running",
      sessionId: "child-scout",
    })
    expect(notified).toHaveLength(0)

    finish({ output: "协议看完了", usage: { input: 1, output: 2, cost: 0 } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(notified).toEqual([
      {
        task: expect.objectContaining({ status: "completed", summary: "协议看完了" }),
        wake: true,
      },
    ])
  })

  it("从登记表停止：中止子会话，记为已停止，不叫醒模型", async () => {
    const { notified } = host()
    let aborted = false
    const startChild: StartChild = (child) =>
      new Promise((_resolve, reject) =>
        child.signal?.addEventListener("abort", () => {
          aborted = true
          reject(new Error("Subagent aborted"))
        }),
      )

    await run({ agent: "scout", task: "看协议", background: true }, startChild)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(registryFor("parent").stop("agent:call-1:0")).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(aborted).toBe(true)
    expect(notified).toEqual([
      { task: expect.objectContaining({ status: "stopped" }), wake: false },
    ])
  })

  it("链式不支持后台，直接拒绝，不启动子任务", async () => {
    host()
    let started = 0
    const { result } = await run(
      { chain: [{ agent: "scout", task: "x" }], background: true },
      async () => {
        started += 1
        return { output: "", usage: { input: 0, output: 0, cost: 0 } }
      },
    )

    expect(started).toBe(0)
    expect(result.content[0]!.text).toMatch(/chain/i)
    expect(registryFor("parent").list()).toEqual([])
  })
})
