import { afterEach, describe, expect, it, vi } from "vitest"
import type { ServerMessage, ServerSnapshot } from "@pig/protocol"
import { GatewayClient, mergeWorkspaceGit } from "@client/gateway-client.js"

class FakeSocket {
  static readonly OPEN = 1
  static last: FakeSocket | undefined
  readyState = FakeSocket.OPEN
  readonly listeners = new Map<string, ((event: unknown) => void)[]>()

  constructor() {
    FakeSocket.last = this
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  send() {}

  close() {}

  receive(message: ServerMessage) {
    for (const listener of this.listeners.get("message") ?? [])
      listener({ data: JSON.stringify(message) })
  }
}

function snapshot(workspaceGit: ServerSnapshot["workspaceGit"]): ServerSnapshot {
  return {
    serverId: "s",
    protocolVersion: 1,
    revision: 0,
    sessions: [],
    models: [],
    defaultModel: null,
    workspaceGit,
  }
}

const main = { branch: "main", detached: false, worktree: false }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("GatewayClient", () => {
  it("每次握手（含重连）拿到的快照都推给订阅者", async () => {
    vi.stubGlobal("WebSocket", FakeSocket)
    const client = new GatewayClient("ws://gateway")
    const seen: ServerSnapshot[] = []
    client.subscribe((next) => seen.push(next))

    const first = client.connect()
    FakeSocket.last!.receive({ type: "hello", snapshot: snapshot({}) })
    await first
    const again = client.reconnect()
    FakeSocket.last!.receive({ type: "hello", snapshot: snapshot({ "/repo": main }) })
    await again

    expect(seen.map((item) => item.workspaceGit)).toEqual([{}, { "/repo": main }])
  })

  it("分支变化单独派发给监听者，不改写客户端自己的快照", async () => {
    vi.stubGlobal("WebSocket", FakeSocket)
    const client = new GatewayClient("ws://gateway")
    const changes: unknown[] = []
    const snapshots: ServerSnapshot[] = []
    client.onWorkspaceGitChanged((next) => changes.push(next))

    const connected = client.connect()
    FakeSocket.last!.receive({ type: "hello", snapshot: snapshot({}) })
    await connected
    client.subscribe((next) => snapshots.push(next))
    FakeSocket.last!.receive({
      type: "event",
      event: { type: "workspace_git_changed", changes: { "/repo": main } },
    })

    expect(changes).toEqual([{ "/repo": main }])
    expect(snapshots).toEqual([])
  })
})

describe("mergeWorkspaceGit", () => {
  it("变化按目录合并，null 表示这个目录不再是仓库", () => {
    const merged = mergeWorkspaceGit(
      {
        "/repo/a": { branch: "main", detached: false, worktree: false },
        "/repo/b": { branch: "main", detached: false, worktree: false },
      },
      {
        "/repo/a": { branch: "feat/x", detached: false, worktree: false },
        "/repo/b": null,
        "/repo/c": { branch: "abc1234", detached: true, worktree: true },
      },
    )

    expect(merged).toEqual({
      "/repo/a": { branch: "feat/x", detached: false, worktree: false },
      "/repo/c": { branch: "abc1234", detached: true, worktree: true },
    })
  })
})
