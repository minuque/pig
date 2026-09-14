import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createWebSocketByteTransportFactory, webSocketUrl } from "@client/transport.js"
import type { ByteTransportHandlers } from "@/types/common-type.js"

type WsEvent = { wasClean?: boolean; code?: number; data?: unknown }

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  binaryType = ""
  sent: ArrayBuffer[] = []
  closeCount = 0
  private handlers = new Map<string, Set<(event: WsEvent) => void>>()

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, fn: (event: WsEvent) => void) {
    let set = this.handlers.get(type)

    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }

    set.add(fn)
  }

  removeEventListener() {}

  emit(type: string, event: WsEvent = {}) {
    for (const fn of this.handlers.get(type) ?? []) fn(event)
  }

  send(data: ArrayBuffer) {
    this.sent.push(data)
  }

  close() {
    this.closeCount += 1
  }
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal("WebSocket", FakeWebSocket)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openTransport() {
  const handlers: ByteTransportHandlers = {
    onData: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
  }

  const factory = createWebSocketByteTransportFactory({ url: "ws://localhost/pi" })
  const transport = await factory(handlers)

  return { transport, socket: FakeWebSocket.instances[0]!, handlers }
}

describe("webSocketUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("显式 base 与桌面壳 dataset 都指向 Gateway", () => {
    expect(webSocketUrl("http://127.0.0.1:9")).toBe("ws://127.0.0.1:9/api/v1/pi")
    vi.stubGlobal("document", {
      documentElement: { dataset: { pigGatewayOrigin: "http://127.0.0.1:9000" } },
    })
    expect(webSocketUrl()).toBe("ws://127.0.0.1:9000/api/v1/pi")
  })

  it("失败路径：pig:// 页且无 Gateway 戳记则抛错", () => {
    vi.stubGlobal("document", { documentElement: { dataset: {} } })
    vi.stubGlobal("window", { location: { href: "pig://app/" } })
    expect(() => webSocketUrl()).toThrow("WebSocket 需要 Gateway 地址")
  })
})

describe("createWebSocketByteTransportFactory", () => {
  it("open 后 send 发送 [byteOffset, byteOffset+byteLength) 精确范围", async () => {
    const { transport, socket } = await openTransport()
    socket.emit("open")
    const pool = new Uint8Array(64)
    const view = pool.subarray(10, 20)
    view.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    await transport.send(view)
    expect(socket.sent).toHaveLength(1)
    expect(new Uint8Array(socket.sent[0]!)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  })

  it("失败路径：open 前 error，send reject，不挂起", async () => {
    const { transport, socket, handlers } = await openTransport()
    const pending = transport.send(new Uint8Array([1]))
    socket.emit("error")
    await expect(pending).rejects.toThrow("WebSocket 连接失败")
    expect(handlers.onError).toHaveBeenCalledTimes(1)
  })
})
