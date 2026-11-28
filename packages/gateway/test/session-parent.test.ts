import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { PiHostService } from "../src/pi/service.js"

let root: string | undefined

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

function header(id: string, cwd: string, at: string, parentSession?: string): string {
  return JSON.stringify({
    type: "session",
    version: 3,
    id,
    timestamp: at,
    cwd,
    ...(parentSession ? { parentSession } : {}),
  })
}

describe("会话列表里的分叉关系", () => {
  it("子会话文件头里的 parentSession 路径映射成父会话 id", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-fork-"))
    const dir = join(root, "sessions")
    const cwd = join(root, "w")
    await mkdir(dir, { recursive: true })
    await mkdir(cwd, { recursive: true })

    const parentPath = join(dir, "2026-11-28T02-25-41-610Z_parent.jsonl")
    const childPath = join(dir, "2026-11-28T04-06-47-938Z_child.jsonl")
    await writeFile(parentPath, `${header("parent", cwd, "2026-11-28T02:25:41.610Z")}\n`)
    await writeFile(childPath, `${header("child", cwd, "2026-11-28T04:06:47.938Z", parentPath)}\n`)

    const host = new PiHostService({ sessionDir: dir, agentDir: join(root, "agent") })
    const sessions = await host.listSessions()

    expect(sessions.find((item) => item.id === "child")?.parentSessionId).toBe("parent")
    expect(sessions.find((item) => item.id === "parent")).not.toHaveProperty("parentSessionId")
    await host.dispose()
  })
})
