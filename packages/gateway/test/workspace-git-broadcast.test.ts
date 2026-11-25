import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { ServerMessage } from "@pig/protocol"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocket } from "ws"

import Gateway from "../src/index.js"
import { canonicalizePath } from "../src/system/directory.js"

const runtime = {
  getProviders: () => [],
  getProvider: () => undefined,
  getProviderAuthStatus: () => ({ configured: false }),
  getAvailable: async () => [],
  hasConfiguredAuth: () => false,
  getModel: () => undefined,
  refresh: async () => ({ aborted: false, errors: new Map() }),
  logout: async () => undefined,
}
let gateway: Gateway | undefined
let root: string | undefined

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined

  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

async function connect(port: number) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`, {
    headers: { authorization: gateway?.authorizationHeader() ?? "" },
  })
  const inbox: ServerMessage[] = []
  const waiters: Array<() => void> = []

  socket.on("message", (data) => {
    inbox.push(JSON.parse(String(data)) as ServerMessage)

    for (const wake of waiters.splice(0)) wake()
  })
  await new Promise((resolve, reject) => socket.once("open", resolve).once("error", reject))

  const next = async (match: (message: ServerMessage) => boolean) => {
    for (;;) {
      const index = inbox.findIndex(match)

      if (index >= 0) return inbox.splice(index, 1)[0] as ServerMessage
      await new Promise<void>((resolve) => waiters.push(resolve))
    }
  }

  socket.send(JSON.stringify({ type: "hello", version: 1 }))
  return { socket, next }
}

describe("git 状态随快照下发、变化时推送", () => {
  it("hello 快照带上次落盘的分支；终端切分支后推 workspace_git_changed", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-git-push-"))
    const cwd = join(root, "work")
    const sessionDir = join(root, "sessions")
    const pigHome = join(root, "pig-home")
    const key = canonicalizePath(cwd)

    await mkdir(join(cwd, ".git"), { recursive: true })
    await writeFile(join(cwd, ".git", "HEAD"), "ref: refs/heads/main\n")
    await mkdir(pigHome, { recursive: true })
    await writeFile(
      join(pigHome, "workspace-git.json"),
      JSON.stringify({
        version: 1,
        workspaces: { [key]: { branch: "main", detached: false, worktree: false } },
      }),
    )
    SessionManager.create(cwd, sessionDir, { id: "s-1" }).appendMessage({
      role: "user",
      content: "第一句",
      timestamp: 1000,
    })
    gateway = new Gateway({
      sessionDir,
      pigHome,
      cwd,
      agentDir: join(root, "agent"),
      createRuntime: async () => runtime as never,
    })

    const { socket, next } = await connect(await gateway.start())
    const hello = await next((message) => message.type === "hello")

    expect(hello.type === "hello" && hello.snapshot.workspaceGit[key]).toEqual({
      branch: "main",
      detached: false,
      worktree: false,
    })

    await writeFile(join(cwd, ".git", "HEAD.lock"), "ref: refs/heads/feat/push\n")
    await rename(join(cwd, ".git", "HEAD.lock"), join(cwd, ".git", "HEAD"))

    const changed = await next(
      (message) =>
        message.type === "event" &&
        message.event.type === "workspace_git_changed" &&
        message.event.changes[key]?.branch === "feat/push",
    )

    expect(changed.type === "event" && changed.event).toEqual({
      type: "workspace_git_changed",
      changes: { [key]: { branch: "feat/push", detached: false, worktree: false } },
    })

    socket.send(
      JSON.stringify({ type: "request", id: "r1", command: { command: "refresh_workspace_git" } }),
    )
    const refreshed = await next((message) => message.type === "response" && message.id === "r1")
    expect(refreshed).toEqual({
      type: "response",
      id: "r1",
      ok: true,
      result: { command: "refresh_workspace_git" },
    })
    socket.close()
  })
})
