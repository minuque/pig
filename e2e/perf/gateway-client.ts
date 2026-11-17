/** 网关基准用的协议客户端：Node 自带 WebSocket，Bearer 通行证同桌面壳。 */
import type { Command, ServerEvent, ServerMessage } from "@pig/protocol"

type Response = Extract<ServerMessage, { type: "response" }>

export type GatewayClient = {
  request(command: Command): Promise<Response>
  onEvent(listener: (event: ServerEvent, at: number) => void): void
  close(): void
}

export async function connectGateway(port: number, authorization: string): Promise<GatewayClient> {
  // Node 的 WebSocket（undici）收 headers；DOM 类型里没有这个重载
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`, {
    headers: { authorization },
  } as never)
  const pending = new Map<string, (message: Response) => void>()
  const listeners: Array<(event: ServerEvent, at: number) => void> = []
  let hello: (() => void) | undefined
  let seq = 0

  socket.addEventListener("message", ({ data }) => {
    const at = performance.now()
    const message = JSON.parse(String(data)) as ServerMessage

    if (message.type === "hello") hello?.()
    else if (message.type === "response") pending.get(message.id)?.(message)
    else if (message.type === "event") for (const listener of listeners) listener(message.event, at)
  })
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  await new Promise<void>((resolve) => {
    hello = resolve
    socket.send(JSON.stringify({ type: "hello", version: 1 }))
  })
  return {
    request(command) {
      const id = `bench-${(seq += 1)}`
      return new Promise((resolve) => {
        pending.set(id, (message) => {
          pending.delete(id)
          resolve(message)
        })
        socket.send(JSON.stringify({ type: "request", id, command }))
      })
    },
    onEvent: (listener) => listeners.push(listener),
    close: () => socket.close(),
  }
}
