import type { Page, WebSocketRoute } from "@playwright/test"
import {
  ClientMessageDecoder,
  ServerMessageDecoder,
  encodeClientMessage,
  encodeServerMessage,
  type SessionSnapshot,
  type TranscriptItem,
} from "@earendil-works/pi-protocol"

export const TURN_PROMPT = "e2e 继续这一轮"

export const TURN_TOKEN = "e2e 首 token"

export const TURN_STREAM_ID = "e2e-turn"

export const STOP_TURN = "停止当前 Turn"

function asBytes(data: Buffer | ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

/** 拦截 prompt / abort，不转发到真实模型；其余消息仍走 Gateway。 */
export async function installTurnBridge(page: Page) {
  let socket: WebSocketRoute | undefined
  let upstream: WebSocketRoute | undefined
  let connections = 0
  let promptSessionId: string | undefined
  let resolvePrompt: ((id: string) => void) | undefined
  const snapshots = new Map<string, SessionSnapshot>()

  await page.routeWebSocket("**/api/v1/pi", (route) => {
    socket = route
    upstream = route.connectToServer()
    connections += 1
    const serverDecoder = new ServerMessageDecoder()
    const clientDecoder = new ClientMessageDecoder()

    const send = (message: Parameters<typeof encodeServerMessage>[0]) => {
      if (!socket) throw new Error("e2e WebSocket 尚未建立")
      socket.send(Buffer.from(encodeServerMessage(message)))
    }

    const reply = (id: string, command: "prompt" | "abort", session: SessionSnapshot) => {
      send({ type: "response", id, ok: true, result: { command, session } })
    }

    const patch = (sessionId: string, phase: "turn" | "idle") => {
      const current = snapshots.get(sessionId)

      if (!current) throw new Error(`e2e 缺少 SessionSnapshot ${sessionId}`)
      const next = { ...current, phase, revision: current.revision + 1 }
      snapshots.set(sessionId, next)
      return next
    }

    upstream.onMessage((data) => {
      if (typeof data === "string") throw new Error("e2e 收到非二进制协议消息")

      for (const message of serverDecoder.push(asBytes(data))) {
        if (message.type === "event" && message.event.type === "session_snapshot")
          snapshots.set(message.event.snapshot.id, message.event.snapshot)

        if (message.type === "response" && message.ok && "session" in message.result)
          snapshots.set(message.result.session.id, message.result.session)
      }

      route.send(data)
    })
    route.onMessage((data) => {
      if (typeof data === "string") throw new Error("e2e 收到非二进制协议消息")

      if (!upstream) throw new Error("e2e WebSocket 尚未连接上游")

      for (const message of clientDecoder.push(asBytes(data))) {
        if (message.type === "request" && message.request.command === "prompt") {
          const sessionId = message.request.sessionId
          const session = patch(sessionId, "turn")

          const userItem = {
            id: "e2e-user",
            role: "user" as const,
            content: [{ type: "text" as const, text: message.request.text }],
            timestamp: Date.now(),
          }

          session.transcript = [...session.transcript, userItem]
          send({
            type: "event",
            event: {
              type: "session_progress",
              sessionId,
              progress: { type: "item_started", item: userItem },
            },
          })
          send({ type: "event", event: { type: "session_snapshot", snapshot: session } })
          reply(message.id, "prompt", session)
          promptSessionId = sessionId
          resolvePrompt?.(sessionId)
          continue
        }

        if (message.type === "request" && message.request.command === "abort") {
          const sessionId = message.request.sessionId
          const session = patch(sessionId, "idle")
          send({
            type: "event",
            event: {
              type: "session_progress",
              sessionId,
              progress: {
                type: "item_finished",
                item: {
                  id: TURN_STREAM_ID,
                  role: "assistant",
                  content: [{ type: "text", text: TURN_TOKEN }],
                  model: session.model,
                  timestamp: 1_700_000_000_000,
                  status: "aborted",
                  stopReason: "aborted",
                },
              },
            },
          })
          send({ type: "event", event: { type: "session_snapshot", snapshot: session } })
          reply(message.id, "abort", session)
          continue
        }

        upstream.send(Buffer.from(encodeClientMessage(message)))
      }
    })
  })
  return {
    snapshots,
    connections: () => connections,
    send(message: Parameters<typeof encodeServerMessage>[0]) {
      if (!socket) throw new Error("e2e WebSocket 尚未建立")
      socket.send(Buffer.from(encodeServerMessage(message)))
    },
    waitForPrompt() {
      if (promptSessionId) return Promise.resolve(promptSessionId)
      return new Promise<string>((resolve) => {
        resolvePrompt = resolve
      })
    },
    async disconnect() {
      snapshots.clear()
      await Promise.all([socket?.close({ code: 1011, reason: "断线" }), upstream?.close()])
    },
  }
}

export function streamingAssistant(
  snapshot: SessionSnapshot,
  text: string,
): Extract<TranscriptItem, { role: "assistant"; status: "streaming" }> {
  return {
    id: TURN_STREAM_ID,
    role: "assistant",
    content: [{ type: "text", text }],
    model: snapshot.model,
    timestamp: 1_700_000_000_000,
    status: "streaming",
  }
}
