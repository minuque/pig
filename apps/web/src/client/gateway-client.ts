/** 与本机 Gateway 的一条 WebSocket 连接：握手、请求应答、服务快照与会话事件分发。 */
import type {
  ClientMessage,
  Command,
  CommandResult,
  ProtocolErrorCode,
  ServerEvent,
  ServerMessage,
  ServerSnapshot,
  SessionMetadata,
  SessionSnapshot,
} from "@pig/protocol"
import { t } from "@i18n/index.js"

export type ConnectionState = "disconnected" | "connecting" | "connected"

export type ConnectionStateChange = { state: ConnectionState; error?: Error }

export type Unsubscribe = () => void

type SessionEvent = Extract<ServerEvent, { type: "session_snapshot" | "session_progress" }>

/** Gateway 拒绝的命令；code 来自协议错误码。 */
export class GatewayRequestError extends Error {
  constructor(
    readonly code: ProtocolErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "GatewayRequestError"
  }
}

type Pending = { resolve(result: CommandResult): void; reject(error: Error): void }

export class GatewayClient {
  #socket: WebSocket | undefined
  #state: ConnectionState = "disconnected"
  #snapshot: ServerSnapshot | undefined
  #seq = 0
  #disposed = false
  readonly #pending = new Map<string, Pending>()
  readonly #snapshotListeners = new Set<(snapshot: ServerSnapshot) => void>()
  readonly #stateListeners = new Set<(change: ConnectionStateChange) => void>()
  readonly #sessionListeners = new Map<string, Set<(event: SessionEvent) => void>>()
  readonly #closeListeners = new Set<() => void>()

  constructor(
    private readonly url: string,
    private readonly onListenerError?: (error: Error) => void,
  ) {}

  get connectionState() {
    return this.#state
  }

  get snapshot() {
    return this.#snapshot
  }

  /** 打开连接并完成握手，返回服务快照。 */
  connect(): Promise<ServerSnapshot> {
    if (this.#disposed) return Promise.reject(new Error(t("errors.wsTransportClosed")))
    this.#setState({ state: "connecting" })
    const socket = new WebSocket(this.url)
    this.#socket = socket
    return new Promise<ServerSnapshot>((resolve, reject) => {
      let settled = false
      const fail = (error: Error) => {
        if (this.#socket === socket) this.#teardown(error)

        if (!settled) {
          settled = true
          reject(error)
        }
      }

      socket.addEventListener("open", () => this.#send(socket, { type: "hello", version: 1 }))
      socket.addEventListener("error", () => fail(new Error(t("errors.wsConnectFailed"))))
      socket.addEventListener("close", (event) =>
        fail(new Error(t("errors.wsClosed", { code: event.code }))),
      )
      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return fail(new Error(t("errors.wsTextFrame")))
        const message = JSON.parse(event.data) as ServerMessage

        if (message.type === "hello") {
          settled = true
          this.#snapshot = message.snapshot
          this.#setState({ state: "connected" })
          resolve(message.snapshot)
          return
        }

        if (message.type === "hello_error") return fail(new Error(message.error.message))
        this.#receive(message)
      })
    })
  }

  /** 断开现有连接后重新握手；已挂的会话需要调用方重新 attach。 */
  async reconnect(): Promise<ServerSnapshot> {
    const socket = this.#socket
    this.#socket = undefined
    socket?.close(1000)
    this.#teardown()
    return this.connect()
  }

  async dispose() {
    if (this.#disposed) return
    this.#disposed = true
    const socket = this.#socket
    this.#socket = undefined
    socket?.close(1000)
    this.#teardown()
  }

  subscribe(listener: (snapshot: ServerSnapshot) => void): Unsubscribe {
    this.#snapshotListeners.add(listener)
    return () => this.#snapshotListeners.delete(listener)
  }

  onConnectionStateChange(listener: (change: ConnectionStateChange) => void): Unsubscribe {
    this.#stateListeners.add(listener)
    return () => this.#stateListeners.delete(listener)
  }

  /** 连接断开时通知；会话据此把自己标成未挂载。 */
  onClose(listener: () => void): Unsubscribe {
    this.#closeListeners.add(listener)
    return () => this.#closeListeners.delete(listener)
  }

  onSessionEvent(sessionId: string, listener: (event: SessionEvent) => void): Unsubscribe {
    const listeners = this.#sessionListeners.get(sessionId) ?? new Set()
    listeners.add(listener)
    this.#sessionListeners.set(sessionId, listeners)
    return () => {
      listeners.delete(listener)

      if (listeners.size === 0) this.#sessionListeners.delete(sessionId)
    }
  }

  async listSessions(): Promise<readonly SessionMetadata[]> {
    const result = await this.request({ command: "list_sessions" })
    return result.command === "list_sessions" ? result.sessions : []
  }

  /** 发命令并等应答；会话类命令的应答带最新快照。 */
  request(command: Command): Promise<CommandResult> {
    const socket = this.#socket

    if (!socket || this.#state !== "connected")
      return Promise.reject(new Error(t("errors.wsTransportClosed")))
    const id = `c${(this.#seq += 1)}`
    return new Promise<CommandResult>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#send(socket, { type: "request", id, command })
    })
  }

  async requestSession(command: Command): Promise<SessionSnapshot> {
    const result = await this.request(command)

    if (!("session" in result)) throw new Error(`Unexpected result for ${command.command}`)
    return result.session
  }

  #send(socket: WebSocket, message: ClientMessage) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }

  #receive(message: ServerMessage) {
    if (message.type === "response") {
      const pending = this.#pending.get(message.id)

      if (!pending) return
      this.#pending.delete(message.id)

      if (message.ok) pending.resolve(message.result)
      else pending.reject(new GatewayRequestError(message.error.code, message.error.message))
      return
    }

    if (message.type !== "event") return
    const event = message.event

    if (event.type === "server_snapshot") {
      this.#snapshot = event.snapshot
      this.#emit(this.#snapshotListeners, event.snapshot)
      return
    }

    const sessionId = event.type === "session_snapshot" ? event.snapshot.id : event.sessionId
    const listeners = this.#sessionListeners.get(sessionId)

    if (listeners) this.#emit(listeners, event)
  }

  #teardown(error?: Error) {
    this.#socket = undefined

    for (const pending of this.#pending.values())
      pending.reject(error ?? new Error(t("errors.wsTransportClosed")))
    this.#pending.clear()

    if (this.#state === "disconnected") return
    this.#setState(error ? { state: "disconnected", error } : { state: "disconnected" })
    this.#emit(this.#closeListeners, undefined)
  }

  #setState(change: ConnectionStateChange) {
    this.#state = change.state
    this.#emit(this.#stateListeners, change)
  }

  #emit<T>(listeners: Iterable<(value: T) => void>, value: T) {
    for (const listener of [...listeners]) {
      try {
        listener(value)
      } catch (error) {
        this.onListenerError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }
}
