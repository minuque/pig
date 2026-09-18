/**
 * Browser WebSocket ByteTransport：将浏览器 WebSocket 适配为 PiClient 的有序二进制传输。
 * 约定：本机 Thin Host 在 `GET /api/v1/pi` 提供 PiServer WebSocket listener，
 * 按 length-prefixed CBOR 帧收发（与 @earendil-works/pi-protocol framing 对齐）。
 */
import type {
  ByteTransport,
  ByteTransportFactory,
  ByteTransportHandlers,
} from "@/types/common-type.js"

// 与 gateway 端 packages/gateway/src/server/websocket.ts 的 WEBSOCKET_PATH 必须一致。
export const WEBSOCKET_PATH = "/api/v1/pi"

export interface WebSocketTransportOptions {
  /** 目标 WebSocket URL。 */
  url: string
}

function stampedGatewayOrigin(): string | undefined {
  if (typeof document === "undefined") return undefined
  const value = document.documentElement.dataset.pigGatewayOrigin

  if (!value) return undefined

  try {
    const url = new URL(value)

    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return undefined
    return url.origin
  } catch {
    return undefined
  }
}

/**
 * 组装本机 PiServer WebSocket URL。
 * 开发态直连 Gateway：Vite 的 `/api` 代理不转 WebSocket。
 * 桌面壳页 origin 是 pig://app，必须用注入的 Gateway 地址。
 */
export function webSocketUrl(base?: string | URL): string {
  const resolved =
    base ?? import.meta.env.VITE_GATEWAY_TARGET ?? stampedGatewayOrigin() ?? window.location.href
  const url = new URL(WEBSOCKET_PATH, resolved)

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:" &&
    url.protocol !== "ws:" &&
    url.protocol !== "wss:"
  ) {
    throw new Error("WebSocket 需要 Gateway 地址")
  }

  url.protocol = url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:"
  return url.href
}

/**
 * 创建连接时即打开 WebSocket；握手 hello 帧在 open 后按序发送。
 * 终态通知（onClose/onError）恰好一次：error/close 事件与主动 close() 都收敛到单一终态；
 * openPromise 一定 settle（open resolve，其余路径 reject），send 不会永久挂起。
 */
export function createWebSocketByteTransportFactory(
  options: WebSocketTransportOptions,
): ByteTransportFactory {
  return (handlers: ByteTransportHandlers): ByteTransport => {
    const socket = new WebSocket(options.url)
    socket.binaryType = "arraybuffer"

    let closed = false
    let opened = false
    let openResolve: () => void = () => {}
    let openReject: (reason?: unknown) => void = () => {}
    const openPromise = new Promise<void>((resolve, reject) => {
      openResolve = resolve
      openReject = reject
    })

    // 无 send 消费者时（open 前失败）也避免 unhandled rejection；await 方仍正常收到 reject
    openPromise.catch(() => {})

    /** 进入终态：恰好一次，且 settle 尚未打开的 openPromise。 */
    function fail(error: Error) {
      if (closed) return
      closed = true
      openReject(error)
      handlers.onError(error)
    }

    /** 有序终态：恰好一次，onClose 与 onError 互斥。 */
    function finish() {
      if (closed) return
      closed = true
      handlers.onClose()
    }

    socket.addEventListener(
      "open",
      () => {
        opened = true
        openResolve()
      },
      { once: true },
    )
    socket.addEventListener("error", () => {
      fail(new Error("WebSocket 连接失败"))
    })
    socket.addEventListener("message", (event) => {
      if (closed) return
      const data = event.data

      if (typeof data === "string") {
        // 协议错误：立即终态并主动关闭底层 socket
        fail(new Error("意外收到文本消息，PiServer 应以二进制帧通信"))
        socket.close()
        return
      }

      handlers.onData(data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data))
    })
    socket.addEventListener("close", (event) => {
      if (event.wasClean && event.code === 1000) finish()
      else fail(new Error(`WebSocket 关闭（code=${event.code}）`))
    })
    return {
      async send(chunk: Uint8Array) {
        await openPromise

        if (closed) throw new Error("WebSocket transport 已关闭")

        // 精确发送 [byteOffset, byteOffset+byteLength) 范围；SharedArrayBuffer 防御拷贝
        const payload =
          chunk.buffer instanceof ArrayBuffer &&
          chunk.byteOffset === 0 &&
          chunk.byteLength === chunk.buffer.byteLength
            ? chunk.buffer
            : chunk.slice().buffer

        socket.send(payload)
      },
      close() {
        if (closed) return

        // open 前关闭：settle openPromise，避免 send 永久 pending
        if (!opened) openReject(new Error("WebSocket transport 已关闭"))
        finish()
        socket.close()
      },
    }
  }
}
