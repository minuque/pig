import { once } from "node:events"
import type { WriteStream } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Environment, ExecOptions } from "@pig/environment"
import type { BashTask, Task } from "@pig/protocol"
import { createTasksExtension } from "../src/tasks/index.ts"

let brokenLogPath: string | undefined

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>()
  return {
    ...fs,
    createWriteStream: (path: string, options?: unknown) => {
      const stream = fs.createWriteStream(brokenLogPath ?? path, options as never)
      logStreams.push(stream)
      return stream
    },
  }
})

type Handler = (...args: never[]) => unknown

type Tool = {
  name: string
  execute(id: string, params: unknown, signal: undefined, update: undefined, ctx: unknown): unknown
}

type Sent = { message: { content: string; details: Task }; options: Record<string, unknown> }

let logDir: string
let sessions = 0
const logStreams: WriteStream[] = []
const shutdowns: Array<() => void> = []

beforeEach(async () => {
  logDir = await mkdtemp(join(tmpdir(), "pig-tasks-"))
})

afterEach(async () => {
  for (const shutdown of shutdowns.splice(0)) shutdown()
  await Promise.all(logStreams.splice(0).map((stream) => stream.closed || once(stream, "close")))
  brokenLogPath = undefined
  await rm(logDir, { recursive: true, force: true })
})

function fakeEnvironment() {
  const runs: Array<{
    command: string
    options: ExecOptions
    exit(code: number): void
  }> = []
  const env = {
    id: "local",
    exec: (command: string, options: ExecOptions) =>
      new Promise<{ exitCode: number | null }>((resolve, reject) => {
        runs.push({ command, options, exit: (exitCode) => resolve({ exitCode }) })
        options.signal?.addEventListener("abort", () => reject(new Error("aborted")))

        if (options.timeout)
          setTimeout(() => reject(new Error(`timeout:${options.timeout}`)), options.timeout * 10)
      }),
  } as unknown as Environment
  return { env, runs }
}

function setup(overrides: { maxRunning?: number; logMaxBytes?: number } = {}) {
  const tools = new Map<string, Tool>()
  const handlers = new Map<string, Handler>()
  const channels = new Map<string, Array<(data: unknown) => void>>()
  const sent: Sent[] = []
  const published: Task[][] = []
  const { env, runs } = fakeEnvironment()
  const pi = {
    registerTool: (tool: Tool) => tools.set(tool.name, tool),
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    sendMessage: (message: Sent["message"], options: Sent["options"]) =>
      sent.push({ message, options }),
    events: {
      emit: (channel: string, data: unknown) =>
        channels.get(channel)?.forEach((listener) => listener(data)),
      on: (channel: string, listener: (data: unknown) => void) => {
        channels.set(channel, [...(channels.get(channel) ?? []), listener])
        return () => undefined
      },
    },
  }
  const sessionId = `s${(sessions += 1)}`
  const ctx = {
    cwd: "/work",
    sessionManager: { getSessionId: () => sessionId, getEntries: () => [] },
  }

  createTasksExtension({
    config: {
      maxRunning: overrides.maxRunning ?? 8,
      outputTailChars: 8000,
      logMaxBytes: overrides.logMaxBytes ?? 10 * 1024 * 1024,
      logDir,
    },
    workspace: () => ({ env, cwd: "/work" }),
  })(pi as never)
  pi.events.on("pig:tasks", (data) => published.push((data as { tasks: Task[] }).tasks))
  void handlers.get("session_start")?.(...([{}, ctx] as never[]))
  shutdowns.push(() => void handlers.get("session_shutdown")?.(...([{}, ctx] as never[])))

  const call = async (name: string, params: unknown) => {
    const result = (await tools.get(name)!.execute("call", params, undefined, undefined, ctx)) as {
      content: Array<{ text: string }>
    }
    return result.content[0]!.text
  }
  const latest = () => published.at(-1) ?? []
  const settle = () => new Promise((resolve) => setTimeout(resolve, 150))
  return { call, runs, sent, latest, settle, handlers, pi, ctx, sessionId }
}

describe("后台任务：启动、结束、停止", () => {
  it("启动立刻返回 task id，任务在跑；正常退出后叫醒模型，通知里有退出码与输出", async () => {
    const { call, runs, sent, latest, settle } = setup()
    const text = await call("bg_task_start", { command: "pnpm test", description: "跑测试" })
    const id = /bash:\w+/.exec(text)?.[0]

    expect(id).toBeTruthy()
    expect(runs[0]?.command).toBe("pnpm test")
    runs[0]!.options.onData(Buffer.from("ok 12 tests\n"))
    await settle()
    expect(latest()[0]).toMatchObject({
      id,
      kind: "bash",
      status: "running",
      output: "ok 12 tests\n",
    })

    runs[0]!.exit(0)
    await settle()
    expect(latest()[0]).toMatchObject({ status: "completed", exitCode: 0 })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.options).toMatchObject({ triggerTurn: true, deliverAs: "followUp" })
    expect(sent[0]!.message.details).toMatchObject({ id, status: "completed" })
    expect(sent[0]!.message.content).toContain("ok 12 tests")
  })

  it("结束时先叫醒模型再发任务列表：宿主看到「没有在跑的任务」时会话已经忙起来，不会被销毁", async () => {
    const { call, runs, sent, pi, settle } = setup()
    const order: string[] = []

    await call("bg_task_start", { command: "pnpm test", description: "跑测试" })
    await settle()
    pi.events.on("pig:tasks", () => order.push(`publish:${sent.length}`))
    runs[0]!.exit(0)
    await settle()
    expect(order[0]).toBe("publish:1")
  })

  it("非零退出码算失败，通知里带退出码", async () => {
    const { call, runs, sent, settle } = setup()

    await call("bg_task_start", { command: "false", description: "会失败" })
    runs[0]!.exit(2)
    await settle()
    expect(sent[0]!.message.details).toMatchObject({ status: "failed", exitCode: 2 })
    expect(sent[0]!.message.content).toContain("exit code 2")
    expect(sent[0]!.options).toMatchObject({ triggerTurn: true })
  })

  it("主动停止：任务变成已停止，只记通知不叫醒模型", async () => {
    const { call, runs, sent, latest, settle } = setup()
    const id = /bash:\w+/.exec(
      await call("bg_task_start", { command: "pnpm dev", description: "开发服务器" }),
    )![0]

    await call("bg_task_stop", { id })
    await settle()
    expect(runs[0]!.options.signal?.aborted).toBe(true)
    expect(latest()[0]).toMatchObject({ status: "stopped" })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.options).toMatchObject({ triggerTurn: false })
  })

  it("界面经事件总线按 id 停止任务", async () => {
    const { call, pi, latest, settle, sessionId } = setup()
    const id = /bash:\w+/.exec(
      await call("bg_task_start", { command: "pnpm dev", description: "开发服务器" }),
    )![0]

    pi.events.emit("pig:tasks:stop", { sessionId: "other", taskId: id })
    expect(latest()[0]).toMatchObject({ status: "running" })
    pi.events.emit("pig:tasks:stop", { sessionId, taskId: id })
    await settle()
    expect(latest()[0]).toMatchObject({ status: "stopped" })
  })

  it("超时：命令被终止，任务算失败并叫醒模型", async () => {
    const { call, sent, settle } = setup()

    await call("bg_task_start", { command: "sleep 99", description: "卡死", timeout: 1 })
    await settle()
    expect(sent[0]!.message.details).toMatchObject({ status: "failed" })
    expect(sent[0]!.message.details.error).toContain("1")
    expect(sent[0]!.options).toMatchObject({ triggerTurn: true })
  })

  it("同时在跑的任务到上限后拒绝启动；有任务结束后名额空出来", async () => {
    const { call, runs, settle } = setup({ maxRunning: 2 })

    await call("bg_task_start", { command: "a", description: "a" })
    await call("bg_task_start", { command: "b", description: "b" })
    expect(await call("bg_task_start", { command: "c", description: "c" })).toContain("2")
    expect(runs).toHaveLength(2)

    runs[0]!.exit(0)
    await settle()
    expect(await call("bg_task_start", { command: "c", description: "c" })).toMatch(/bash:\w+/)
  })

  it("完整输出落盘；超过上限后停止写入并记一行说明，任务继续跑", async () => {
    const { call, runs, latest, settle, sessionId } = setup({ logMaxBytes: 16 })
    const id = /bash:\w+/.exec(
      await call("bg_task_start", { command: "yes", description: "刷屏" }),
    )![0]

    runs[0]!.options.onData(Buffer.from("0123456789\n"))
    runs[0]!.options.onData(Buffer.from("abcdefghij\n"))
    runs[0]!.options.onData(Buffer.from("third\n"))
    await settle()
    const task = latest()[0] as BashTask
    const log = await readFile(task.logPath!, "utf8")

    expect(task.logPath).toBe(join(logDir, sessionId, `${id.replace(":", "-")}.log`))
    expect(log.startsWith("0123456789\n")).toBe(true)
    expect(log).not.toContain("abcdefghij")
    expect(log).not.toContain("third")
    expect(log).toContain("not saved")
    expect(task).toMatchObject({ status: "running", output: "0123456789\nabcdefghij\nthird\n" })
  })

  it("已结束的任务只留最近 20 条，在跑的不受影响", async () => {
    const { call, runs, latest, settle } = setup()
    const ids: string[] = []

    for (let index = 0; index < 25; index += 1) {
      ids.push(
        /bash:\w+/.exec(
          await call("bg_task_start", { command: `c${index}`, description: "d" }),
        )![0],
      )
      runs[index]!.exit(0)
    }

    await call("bg_task_start", { command: "still", description: "在跑" })
    await settle()
    const tasks = latest()

    expect(tasks.filter((task) => task.status === "completed").map((task) => task.id)).toEqual(
      ids.slice(-20),
    )
    expect(tasks.find((task) => task.status === "running")).toMatchObject({ command: "still" })
  })

  it("日志写不进去时任务照常跑完，宿主进程不崩", async () => {
    brokenLogPath = logDir
    const { call, runs, latest, settle } = setup()
    await call("bg_task_start", { command: "echo hi", description: "日志坏了" })

    runs[0]!.options.onData(Buffer.from("hi\n"))
    await settle()
    runs[0]!.exit(0)
    await settle()

    expect(latest()[0]).toMatchObject({ status: "completed", output: "hi\n" })
  })

  it("读输出：带上日志路径", async () => {
    const { call, runs } = setup()
    const id = /bash:\w+/.exec(await call("bg_task_start", { command: "a", description: "a" }))![0]

    runs[0]!.options.onData(Buffer.from("hello\n"))
    const text = await call("bg_task_output", { id })

    expect(text).toContain("hello")
    expect(text).toContain(logDir)
  })

  it("会话关闭：在跑的任务全部停止，各留一条已停止的通知", async () => {
    const { call, runs, sent, handlers, ctx } = setup()

    await call("bg_task_start", { command: "a", description: "a" })
    await call("bg_task_start", { command: "b", description: "b" })
    await handlers.get("session_shutdown")?.(...([{}, ctx] as never[]))

    expect(runs.every((run) => run.options.signal?.aborted)).toBe(true)
    expect(sent.map((item) => item.message.details.status)).toEqual(["stopped", "stopped"])
    expect(sent.every((item) => item.options.triggerTurn === false)).toBe(true)
  })
})
