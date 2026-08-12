import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWebSocketByteTransportFactory,
  type WebSocketTransportOptions,
} from "../src/client/transport.js";
import type { ByteTransport, ByteTransportHandlers } from "@earendil-works/pi-client";

type WsEvent = { wasClean?: boolean; code?: number; data?: unknown };

/** 假 WebSocket：记录发送的 payload、close 次数，测试手动触发 open/error/close/message。 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  binaryType = "";
  sent: ArrayBuffer[] = [];
  closeCount = 0;
  private handlers = new Map<string, Set<(event: WsEvent) => void>>();
  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type: string, fn: (event: WsEvent) => void) {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn);
  }
  removeEventListener() {}
  emit(type: string, event: WsEvent = {}) {
    for (const fn of this.handlers.get(type) ?? []) fn(event);
  }
  send(data: ArrayBuffer) {
    this.sent.push(data);
  }
  close() {
    this.closeCount += 1;
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function openTransport(options: Partial<WebSocketTransportOptions> = {}) {
  const onData = vi.fn<(chunk: Uint8Array) => void>();
  const handlers: ByteTransportHandlers = {
    onData,
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  const factory = createWebSocketByteTransportFactory({
    url: "ws://localhost/pi",
    ...options,
  });
  const transport = await factory(handlers);
  return { transport, socket: FakeWebSocket.instances[0]!, handlers, onData };
}

describe("createWebSocketByteTransportFactory", () => {
  it("open 后 send 发送 [byteOffset, byteOffset+byteLength) 精确范围", async () => {
    const { transport, socket } = await openTransport();
    socket.emit("open");
    const pool = new Uint8Array(64);
    const view = pool.subarray(10, 20);
    view.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await transport.send(view);
    expect(socket.sent).toHaveLength(1);
    expect(new Uint8Array(socket.sent[0]!)).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    );
  });

  it("open 前 error：send reject，不挂起", async () => {
    const { transport, socket, handlers } = await openTransport();
    const pending = transport.send(new Uint8Array([1]));
    socket.emit("error");
    await expect(pending).rejects.toThrow("WebSocket 连接失败");
    expect(handlers.onError).toHaveBeenCalledTimes(1);
  });

  it("open 前 close：send reject，不永久 pending", async () => {
    const { transport, socket } = await openTransport();
    const pending = transport.send(new Uint8Array([1]));
    transport.close();
    expect(socket.closeCount).toBe(1);
    await expect(pending).rejects.toThrow("已关闭");
  });

  it("单终态：error 后 close 事件不再通知", async () => {
    const { socket, handlers } = await openTransport();
    socket.emit("error");
    expect(handlers.onError).toHaveBeenCalledTimes(1);
    socket.emit("close", { wasClean: false, code: 1006 });
    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("有序关闭恰好一次 onClose", async () => {
    const { socket, handlers } = await openTransport();
    socket.emit("close", { wasClean: true, code: 1000 });
    socket.emit("close", { wasClean: true, code: 1000 });
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("close() 幂等且抑制后续终态通知", async () => {
    const { transport, socket, handlers } = await openTransport();
    transport.close();
    transport.close();
    expect(socket.closeCount).toBe(1);
    socket.emit("close", { wasClean: true, code: 1000 });
    socket.emit("error");
    expect(handlers.onClose).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("文本消息按协议错误处理并终止传输", async () => {
    const { transport, socket, handlers } = await openTransport();
    socket.emit("open");
    socket.emit("message", { data: "not binary" });
    expect(handlers.onError).toHaveBeenCalledTimes(1);
    await expect(transport.send(new Uint8Array([1]))).rejects.toThrow("已关闭");
  });

  it("send 顺序与载荷透传（ByteTransport 契约）", async () => {
    const { transport, socket } = await openTransport();
    socket.emit("open");
    const first = new Uint8Array([1, 2]);
    const second = new Uint8Array([3]);
    await transport.send(first);
    await transport.send(second);
    expect(socket.sent.map((b) => Array.from(new Uint8Array(b)))).toEqual([[1, 2], [3]]);
  });

  it("onData 收到二进制消息（ArrayBuffer 视图）", async () => {
    const { socket, onData } = await openTransport();
    socket.emit("open");
    const buffer = new Uint8Array([9, 8, 7]).buffer;
    socket.emit("message", { data: buffer });
    expect(onData).toHaveBeenCalledTimes(1);
    expect(Array.from(onData.mock.calls[0]![0] as Uint8Array)).toEqual([9, 8, 7]);
  });
});
