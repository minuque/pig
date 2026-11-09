import { randomUUID } from "node:crypto"
import type {
  Command,
  CommandResult,
  ServerMessage,
  SessionMetadata,
  SessionSnapshot,
} from "@pig/protocol"
import {
  GatewayError,
  type SessionRuntime,
  type SessionRuntimeEvent,
  type SessionService,
} from "../pi/runtime-types.js"

/** 一条客户端连接；协议层负责收发，这里只记它挂了哪些会话。 */
export interface ClientConnection {
  readonly sessionIds: Set<string>
  readonly closed: boolean
  send(message: ServerMessage): void
}

interface LiveSession {
  id: string
  runtime: SessionRuntime
  connections: Set<ClientConnection>
  unsubscribe: () => void
  operationCount: number
  terminal: boolean
  disposing?: Promise<void>
}

export interface LiveSessionOptions {
  service: SessionService
  broadcastServerSnapshot(): void
  reportError(error: unknown): void
  isClosing(): boolean
}

type RunCommand = "prompt" | "steer" | "abort" | "set_model" | "set_thinking_level"

function toMetadata(snapshot: SessionSnapshot): SessionMetadata {
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    ...(snapshot.name === undefined ? {} : { sessionName: snapshot.name }),
    cwd: snapshot.cwd,
  }
}

/**
 * 已打开会话的登记表：多连接可挂同一会话，事件扇出给所有挂着的连接；
 * 没有连接、没有进行中的命令且空闲时释放运行时。
 */
export class LiveSessions {
  private readonly live = new Map<string, LiveSession>()
  private readonly opening = new Map<string, Promise<LiveSession>>()

  constructor(private readonly options: LiveSessionOptions) {}

  async execute(connection: ClientConnection, command: Command): Promise<CommandResult> {
    switch (command.command) {
      case "list_sessions":
        return { command: "list_sessions", sessions: await this.listMetadata() }
      case "create_session": {
        const id = randomUUID()
        const { command: _command, ...rest } = command
        const session = await this.attachTo(connection, id, () =>
          this.options.service.createSession({ id, ...rest }),
        )
        return { command: "create_session", session }
      }

      case "attach_session": {
        const session = await this.attachTo(connection, command.sessionId, () =>
          this.options.service.openSession(command.sessionId),
        )
        return { command: "attach_session", session }
      }

      case "detach_session":
        await this.detach(connection, command.sessionId)
        return { command: "detach_session", sessionId: command.sessionId }
      case "prompt":
        return this.run(connection, command, (runtime) => runtime.prompt({ text: command.message }))
      case "steer":
        return this.run(connection, command, (runtime) => runtime.steer({ text: command.message }))
      case "abort":
        return this.run(connection, command, (runtime) => runtime.abort())
      case "set_model":
        return this.run(connection, command, (runtime) => runtime.setModel(command.model))
      case "set_thinking_level":
        return this.run(connection, command, (runtime) => runtime.setThinking(command.level))
      case "extension_ui_response":
        this.attached(connection, command.sessionId).runtime.respondExtensionUi(command.response)
        return { command: "extension_ui_response", sessionId: command.sessionId }
    }
  }

  /** 连接断开：从所有会话摘下，能释放的释放。 */
  async disconnect(connection: ClientConnection) {
    const sessions = [...connection.sessionIds].flatMap((id) => this.live.get(id) ?? [])
    connection.sessionIds.clear()

    for (const live of sessions) live.connections.delete(connection)
    const results = await Promise.allSettled(sessions.map((live) => this.maybeDispose(live)))

    for (const result of results)
      if (result.status === "rejected") this.options.reportError(result.reason)
  }

  /** 磁盘会话列表叠上运行中会话的最新元数据。 */
  async listMetadata(): Promise<SessionMetadata[]> {
    const stored = await this.options.service.listSessions()
    const liveById = new Map<string, SessionSnapshot>()

    for (const live of this.live.values())
      if (!live.disposing) liveById.set(live.id, await this.snapshotOf(live))

    const metadata = stored.map((item) => {
      const snapshot = liveById.get(item.id)

      if (!snapshot) return item
      liveById.delete(item.id)
      return { ...item, ...toMetadata(snapshot) }
    })

    for (const snapshot of liveById.values()) metadata.push(toMetadata(snapshot))
    return metadata
  }

  async close() {
    await Promise.allSettled([...this.opening.values()])
    const sessions = [...this.live.values()]
    this.live.clear()
    await Promise.all(
      sessions.map(async (live) => {
        if (live.disposing) return live.disposing
        live.unsubscribe()
        await live.runtime.dispose()
      }),
    )
  }

  private async attachTo(
    connection: ClientConnection,
    id: string,
    acquire: () => Promise<SessionRuntime>,
  ): Promise<SessionSnapshot> {
    const live = await this.acquire(id, acquire)

    if (connection.closed) {
      await this.maybeDispose(live)
      throw new GatewayError("invalid_request", "Connection closed while attaching to a session")
    }

    connection.sessionIds.add(live.id)
    live.connections.add(connection)
    const snapshot = await this.broadcastSnapshot(live)
    this.options.broadcastServerSnapshot()

    // 断线前没答完的扩展对话框：新挂上的连接补收
    for (const request of live.runtime.extensionDialogs())
      connection.send({
        type: "event",
        event: { type: "extension_ui_request", sessionId: live.id, request },
      })
    return { ...snapshot, attached: true }
  }

  private async detach(connection: ClientConnection, sessionId: string) {
    if (!connection.sessionIds.delete(sessionId)) return
    const live = this.live.get(sessionId)

    if (live) {
      live.connections.delete(connection)

      if (live.connections.size > 0 && !live.terminal && !live.disposing)
        await this.broadcastSnapshot(live)
      await this.maybeDispose(live)
    }

    this.options.broadcastServerSnapshot()
  }

  /** 连接必须先挂上会话，会话必须还活着。 */
  private attached(connection: ClientConnection, sessionId: string): LiveSession {
    if (!connection.sessionIds.has(sessionId))
      throw new GatewayError(
        "invalid_request",
        `Connection is not attached to session ${sessionId}`,
      )
    const live = this.live.get(sessionId)

    if (!live || live.terminal || live.disposing)
      throw new GatewayError("not_found", `Session is not live: ${sessionId}`)
    return live
  }

  private async run(
    connection: ClientConnection,
    command: Extract<Command, { command: RunCommand }>,
    operation: (runtime: SessionRuntime) => Promise<void>,
  ): Promise<CommandResult> {
    const live = this.attached(connection, command.sessionId)
    live.operationCount += 1

    try {
      await operation(live.runtime)
      const snapshot = await this.broadcastSnapshot(live)
      return { command: command.command, session: { ...snapshot, attached: true } }
    } finally {
      live.operationCount -= 1
      this.scheduleDispose(live)
    }
  }

  private async acquire(id: string, acquire: () => Promise<SessionRuntime>): Promise<LiveSession> {
    for (;;) {
      const existing = this.live.get(id)

      if (existing) {
        if (existing.terminal)
          throw new GatewayError("session_locked", `Session runtime is terminating: ${id}`)

        if (existing.disposing) {
          await existing.disposing
          continue
        }

        return existing
      }

      const pending = this.opening.get(id)

      if (pending) return pending
      const created = this.create(id, acquire)
      this.opening.set(id, created)

      try {
        return await created
      } finally {
        if (this.opening.get(id) === created) this.opening.delete(id)
      }
    }
  }

  private async create(id: string, acquire: () => Promise<SessionRuntime>): Promise<LiveSession> {
    const runtime = await acquire()

    if (this.options.isClosing()) {
      await runtime.dispose()
      throw new GatewayError("internal_error", "Gateway closed while opening a session")
    }

    const snapshot = await runtime.snapshot()

    if (snapshot.id !== id) {
      await runtime.dispose()
      throw new GatewayError("invalid_request", `Runtime returned session ${snapshot.id} for ${id}`)
    }

    const live: LiveSession = {
      id,
      runtime,
      connections: new Set(),
      unsubscribe: () => {},
      operationCount: 0,
      terminal: false,
    }

    live.unsubscribe = runtime.subscribe((event) => this.handleEvent(live, event))
    this.live.set(id, live)
    return live
  }

  private handleEvent(live: LiveSession, event: SessionRuntimeEvent) {
    if (event.type === "error") {
      live.terminal = true
      this.options.reportError(event.error)
      this.scheduleDispose(live)
      return
    }

    if (event.type === "extension_ui") {
      const message: ServerMessage = {
        type: "event",
        event: { type: "extension_ui_request", sessionId: live.id, request: event.request },
      }

      for (const connection of live.connections) connection.send(message)
      return
    }

    if (event.type === "progress") {
      const message: ServerMessage = {
        type: "event",
        event: { type: "session_progress", sessionId: live.id, progress: event.progress },
      }

      for (const connection of live.connections) connection.send(message)
    } else {
      void this.broadcastSnapshot(live).catch((error) => this.options.reportError(error))
    }

    this.scheduleDispose(live)
  }

  private async snapshotOf(live: LiveSession): Promise<SessionSnapshot> {
    const snapshot = await live.runtime.snapshot()
    return {
      ...snapshot,
      phase: live.runtime.getPhase(),
      attached: live.connections.size > 0,
      locked: true,
    }
  }

  private async broadcastSnapshot(live: LiveSession) {
    const snapshot = await this.snapshotOf(live)

    for (const connection of live.connections)
      connection.send({ type: "event", event: { type: "session_snapshot", snapshot } })
    return snapshot
  }

  private scheduleDispose(live: LiveSession) {
    void this.maybeDispose(live).catch((error) => this.options.reportError(error))
  }

  private async maybeDispose(live: LiveSession): Promise<void> {
    if (
      this.options.isClosing() ||
      live.disposing ||
      live.connections.size > 0 ||
      live.operationCount > 0 ||
      (!live.terminal && live.runtime.getPhase() !== "idle")
    )
      return live.disposing

    live.unsubscribe()
    live.disposing = live.runtime.dispose().finally(() => {
      if (this.live.get(live.id) === live) this.live.delete(live.id)
    })
    await live.disposing

    if (!this.options.isClosing()) this.options.broadcastServerSnapshot()
  }
}
