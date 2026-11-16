import type { Page, WebSocketRoute } from "@playwright/test"
import type { ClientMessage, ServerMessage, SessionSnapshot, TranscriptItem } from "@pig/protocol"

export const TURN_PROMPT = "e2e 继续这一轮"
export const TURN_TOKEN = "e2e 首 token"
export const TURN_STREAM_ID = "e2e-turn"
export const STOP_TURN = "停止当前 Turn"

function decode<T>(data: string | Buffer): T {
  if (typeof data !== "string") throw new Error("e2e 收到非文本协议消息")
  return JSON.parse(data) as T
}

/**
 * 拦截 prompt / abort，不转发到真实模型；其余消息仍走 Gateway。
 * holdPromptReply 模拟真实网关：prompt 的应答等这一轮结束（这里是 abort）才回。
 */
export async function installTurnBridge(page: Page, options: { holdPromptReply?: boolean } = {}) {
  let socket: WebSocketRoute | undefined
  let upstream: WebSocketRoute | undefined
  let connections = 0
  let promptSessionId: string | undefined
  let resolvePrompt: ((id: string) => void) | undefined
  const snapshots = new Map<string, SessionSnapshot>()
  const prompted: string[] = []
  const heldReplies = new Map<string, string>()

  await page.routeWebSocket("**/api/v1/pi", (route) => {
    socket = route
    upstream = route.connectToServer()
    connections += 1

    const send = (message: ServerMessage) => {
      if (!socket) throw new Error("e2e WebSocket 尚未建立")
      socket.send(JSON.stringify(message))
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
      {
        const message = decode<ServerMessage>(data)

        if (message.type === "event" && message.event.type === "session_snapshot")
          snapshots.set(message.event.snapshot.id, message.event.snapshot)

        if (message.type === "response" && message.ok && "session" in message.result)
          snapshots.set(message.result.session.id, message.result.session)
      }

      route.send(data)
    })
    route.onMessage((data) => {
      if (!upstream) throw new Error("e2e WebSocket 尚未连接上游")

      for (const message of [decode<ClientMessage>(data)]) {
        if (message.type === "request" && message.command.command === "prompt") {
          const sessionId = message.command.sessionId
          const session = patch(sessionId, "turn")
          const userItem = {
            id: "e2e-user",
            role: "user" as const,
            content: [{ type: "text" as const, text: message.command.message }],
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

          if (options.holdPromptReply) heldReplies.set(sessionId, message.id)
          else reply(message.id, "prompt", session)
          prompted.push(sessionId)
          promptSessionId = sessionId
          resolvePrompt?.(sessionId)
          continue
        }

        if (message.type === "request" && message.command.command === "abort") {
          const sessionId = message.command.sessionId
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
          const held = heldReplies.get(sessionId)

          if (held) {
            heldReplies.delete(sessionId)
            reply(held, "prompt", session)
          }

          continue
        }

        upstream.send(JSON.stringify(message))
      }
    })
  })
  return {
    snapshots,
    /** 收到过 prompt 的会话 id，按到达顺序。 */
    prompted,
    connections: () => connections,
    send(message: ServerMessage) {
      if (!socket) throw new Error("e2e WebSocket 尚未建立")
      socket.send(JSON.stringify(message))
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
