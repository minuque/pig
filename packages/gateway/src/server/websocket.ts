import { randomUUID } from "node:crypto"
import type { IncomingMessage, Server } from "node:http"
import type { Duplex } from "node:stream"
import {
  WEBSOCKET_PATH,
  type ClientMessage,
  type ServerMessage,
  type ServerSnapshot,
  type SessionArchives,
  type UserPreferences,
} from "@pig/protocol"
import { WebSocket, WebSocketServer, type RawData } from "ws"
import { GatewayError, type SessionService } from "../pi/runtime-types.js"
import { LiveSessions, type ClientConnection } from "./live-sessions.js"

const MAX_MESSAGE_BYTES = 16 * 1024 * 1024
const MAX_PENDING_BYTES = 16 * 1024 * 1024
const HANDSHAKE_TIMEOUT_MS = 30_000

export interface ProtocolServerOptions {
  server: Server
  service: SessionService
  allow(req: IncomingMessage): 401 | 403 | undefined
  onError(error: unknown): void
}

class SocketConnection implements ClientConnection {
  readonly sessionIds = new Set<string>()
  ready = false
  private pending = 0

  constructor(private readonly socket: WebSocket) {}

  get closed() {
    return this.socket.readyState !== WebSocket.OPEN
  }

  send(message: ServerMessage) {
    if (this.closed) return
    const text = JSON.stringify(message)
    const bytes = Buffer.byteLength(text)

    if (this.pending + bytes > MAX_PENDING_BYTES) {
      this.socket.terminate()
      return
    }

    this.pending += bytes
    this.socket.send(text, () => {
      this.pending -= bytes
    })
  }
}

function parse(data: RawData): ClientMessage | undefined {
  try {
    const value = JSON.parse(Array.isArray(data) ? Buffer.concat(data).toString() : String(data))
    return typeof value === "object" && value !== null && "type" in value
      ? (value as ClientMessage)
      : undefined
  } catch {
    return undefined
  }
}

function toProtocolError(error: unknown) {
  if (error instanceof GatewayError) return { code: error.code, message: error.message }
  return { code: "internal_error" as const, message: "Internal server error" }
}

export class ProtocolServer {
  private readonly wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
    perMessageDeflate: false,
  })
  private readonly connections = new Set<SocketConnection>()
  private readonly serverId = randomUUID()
  private readonly sessions: LiveSessions
  private revision = 0
  private closing = false
  private broadcastQueue = Promise.resolve()
  private readonly onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) =>
    this.upgrade(req, socket, head)

  constructor(private readonly options: ProtocolServerOptions) {
    this.sessions = new LiveSessions({
      service: options.service,
      broadcastServerSnapshot: () => this.broadcastServerSnapshot(),
      reportError: options.onError,
      isClosing: () => this.closing,
    })
    options.server.on("upgrade", this.onUpgrade)
  }

  async close() {
    this.closing = true
    this.options.server.off("upgrade", this.onUpgrade)

    for (const client of this.wss.clients) client.close(1001)
    this.wss.close()
    await this.sessions.close()
  }

  broadcastPreferences(preferences: UserPreferences) {
    if (this.closing) return
    const ready = [...this.connections].filter((connection) => connection.ready)

    for (const connection of ready)
      connection.send({ type: "event", event: { type: "preferences_changed", preferences } })
  }

  broadcastSessionArchives(archives: SessionArchives) {
    if (this.closing) return
    const ready = [...this.connections].filter((connection) => connection.ready)

    for (const connection of ready)
      connection.send({ type: "event", event: { type: "session_archives_changed", archives } })
  }

  broadcastServerSnapshot() {
    const run = this.broadcastQueue.then(async () => {
      const ready = [...this.connections].filter((connection) => connection.ready)

      if (ready.length === 0 || this.closing) return
      this.revision += 1
      const snapshot = await this.serverSnapshot()

      for (const connection of ready)
        connection.send({ type: "event", event: { type: "server_snapshot", snapshot } })
    })

    this.broadcastQueue = run.catch((error) => this.options.onError(error))
  }

  private async serverSnapshot(): Promise<ServerSnapshot> {
    const [sessions, catalog] = await Promise.all([
      this.sessions.listMetadata(),
      this.options.service.listModels(),
    ])
    return {
      serverId: this.serverId,
      protocolVersion: 1,
      revision: this.revision,
      sessions,
      models: catalog.models,
      defaultModel: catalog.defaultModel,
    }
  }

  private upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")

    if (url.pathname !== WEBSOCKET_PATH) {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n")
      socket.destroy()
      return
    }

    const rejection = this.options.allow(req)

    if (rejection) {
      const reason = rejection === 401 ? "Unauthorized" : "Forbidden"
      socket.write(`HTTP/1.1 ${rejection} ${reason}\r\nConnection: close\r\n\r\n`)
      socket.destroy()
      return
    }

    this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws))
  }

  private accept(ws: WebSocket) {
    if (this.closing) {
      ws.close(1013, "host is not ready")
      return
    }

    const connection = new SocketConnection(ws)
    this.connections.add(connection)

    const handshake = setTimeout(() => {
      if (!connection.ready) ws.close(1002, "handshake timeout")
    }, HANDSHAKE_TIMEOUT_MS)

    handshake.unref()

    ws.on("message", (data, isBinary) => {
      const message = isBinary ? undefined : parse(data)

      if (!message) {
        ws.close(1003, "expected JSON text frames")
        return
      }

      void this.handle(connection, message).catch((error) => this.options.onError(error))
    })
    ws.on("close", () => {
      clearTimeout(handshake)
      this.connections.delete(connection)
      void this.sessions.disconnect(connection)
    })
    ws.on("error", (error) => this.options.onError(error))
  }

  private async handle(connection: SocketConnection, message: ClientMessage) {
    if (message.type === "hello") {
      if (message.version !== 1) {
        connection.send({
          type: "hello_error",
          error: { code: "version", message: "Unsupported protocol version" },
        })
        return
      }

      connection.send({ type: "hello", snapshot: await this.serverSnapshot() })
      connection.ready = true
      return
    }

    try {
      if (!connection.ready) throw new GatewayError("invalid_request", "Handshake required")
      const result = await this.sessions.execute(connection, message.command)
      connection.send({ type: "response", id: message.id, ok: true, result })
    } catch (error) {
      if (!(error instanceof GatewayError)) this.options.onError(error)
      connection.send({
        type: "response",
        id: message.id,
        ok: false,
        error: toProtocolError(error),
      })
    }
  }
}
