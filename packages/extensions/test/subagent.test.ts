import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createSubagentTool, type SubagentDetails } from "../src/subagent/index.ts"
import type { ChildRun, StartChild } from "../src/subagent/run.ts"

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
const ctx = () =>
  ({
    cwd: root,
    model: undefined,
    thinkingLevel: undefined,
    sessionManager: {
      getSessionFile: () => join(root, "parent.jsonl"),
      getSessionDir: () => root,
      getEntries: () => [],
    },
    modelRegistry: { find: () => undefined, getAvailable: () => [] },
  }) as never

type Update = { details: SubagentDetails }

async function run(params: Record<string, unknown>, startChild: StartChild, signal?: AbortSignal) {
  const updates: Update[] = []
  const tool = createSubagentTool({ startChild })
  const result = await tool.execute(
    "call-1",
    params as never,
    signal,
    (update) => {
      updates.push(update as Update)
    },
    ctx(),
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
    expect(result.details.results.map((item) => [item.agent, item.status, item.sessionId])).toEqual(
      [
        ["scout", "done", "child-scout"],
        ["planner", "done", "child-planner"],
        ["reviewer", "done", "child-reviewer"],
      ],
    )
    expect(result.details.results[0]?.output).toBe("scout 完成")
    expect(peak).toBeLessThanOrEqual(4)
    // 卡片实时进度：跑的过程中有「运行中 + 最近一步」的更新
    expect(
      updates.some((update) =>
        update.details.results.some(
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

  it("中止主会话：所有在跑的子任务收到中止，状态记为 aborted", async () => {
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

    expect(result.details.results.map((item) => item.status)).toEqual(["aborted", "aborted"])
  })
})
