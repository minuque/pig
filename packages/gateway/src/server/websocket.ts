import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { DEFAULT_MAX_FRAME_LENGTH } from "@earendil-works/pi-protocol";
import type { PiServerListener } from "@earendil-works/pi-server";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import type { BootstrapAuth } from "../auth/bootstrap.js";

// pi-server 未从入口导出 connection 类型，从 PiServerListener 签名反推
/** 已授权的有序字节连接（认证完成后的连接）。 */
type ByteConnection = Parameters<Parameters<PiServerListener["start"]>[0]>[0];
/** 认证完成后把连接交给 PiServer 的接收器。 */
type ByteConnectionAcceptor = Parameters<PiServerListener["start"]>[0];
type ByteConnectionHandler = ReturnType<ByteConnectionAcceptor>;

/** Host WebSocket 路径：认证经查询参数传递（浏览器无法自定义 header）。 */
const WEBSOCKET_PATH = "/api/v1/pi";

export interface WebSocketListenerOptions {
  /** 承载升级的 HTTP server（只绑定 127.0.0.1）。 */
  server: Server;
  auth: BootstrapAuth;
  /** 单帧上限：同时作为 ws 接收 payload 上限，需与 PiServer maxFrameLength 一致。 */
  maxFrameLength?: number;
  /** 每连接待发送积压上限：慢客户端超限时断开。 */
  maxPendingBytes?: number;
  onError?: (error: Error) => void;
}

const DEFAULT_MAX_PENDING_BYTES = 16 * 1024 * 1024;
const GRACEFUL_CLOSE_TIMEOUT_MS = 5_000;

/**
 * PiServerListener 的 WebSocket 实现：升级前完成 credential 认证，
 * 认证通过后把连接交给 PiServer（ByteConnectionAcceptor）。
 */
export function createWebSocketListener(options: WebSocketListenerOptions): PiServerListener {
  const { server, auth } = options;
  const maxFrameLength = options.maxFrameLength ?? DEFAULT_MAX_FRAME_LENGTH;
  const maxPendingBytes = options.maxPendingBytes ?? DEFAULT_MAX_PENDING_BYTES;
  const onError = options.onError;
  const wss = new WebSocketServer({
    noServer: true,
    // ws 的 maxPayload 是整条 WebSocket 消息上限；PiServer maxFrameLength 只算 CBOR
    // payload，协议帧还含 4 字节长度头，需放宽，避免拒绝合法的边界帧。
    maxPayload: maxFrameLength + 4,
    perMessageDeflate: false,
  });
  let accept: ByteConnectionAcceptor | undefined;

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const credential = url.searchParams.get("credential") ?? undefined;
    if (url.pathname !== WEBSOCKET_PATH || !auth.verify(credential)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!accept) {
        // PiServer 尚未就绪（启动中/关闭中）
        ws.close(1013, "host is not ready");
        return;
      }
      const handler = accept(new WebSocketByteConnection(ws, maxPendingBytes, onError));
      ws.on("message", (data, isBinary) => {
        if (!isBinary) {
          ws.close(1003, "binary frames only");
          return;
        }
        handler.onData(toUint8Array(data));
      });
      ws.on("close", () => handler.onClose());
      ws.on("error", (error) => handler.onError(error));
    });
  };
  server.on("upgrade", onUpgrade);

  return {
    async start(acceptor: ByteConnectionAcceptor) {
      accept = acceptor;
    },
    async close() {
      accept = undefined;
      server.off("upgrade", onUpgrade);
      // 存量连接由 PiServer closeServerState 逐个 close
      wss.close();
    },
  };
}

/** 有序字节连接：以本地 pending 计数（已发送未确认的字节）实现积压上限。 */
class WebSocketByteConnection implements ByteConnection {
  // 单一积压计数：send 调用时累加，回调时扣减，覆盖 ws 内部缓冲（回调在数据
  // 交给内核后触发），不与 bufferedAmount 重复计算。
  private pendingBytes = 0;
  private closedValue = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly maxPendingBytes: number,
    private readonly onError?: (error: Error) => void,
  ) {
    socket.on("close", () => {
      this.closedValue = true;
    });
  }

  get closed() {
    return this.closedValue;
  }

  send(chunk: Uint8Array): Promise<void> {
    if (this.closedValue) return Promise.reject(new Error("WebSocket connection is closed"));
    if (this.pendingBytes + chunk.byteLength > this.maxPendingBytes) {
      // 慢客户端：待发送积压超限，断开
      this.onError?.(new Error(`WebSocket send backlog exceeded ${this.maxPendingBytes} bytes`));
      this.closedValue = true;
      this.socket.terminate();
      return Promise.resolve();
    }
    this.pendingBytes += chunk.byteLength;
    return new Promise((resolve, reject) => {
      this.socket.send(chunk, (error) => {
        this.pendingBytes -= chunk.byteLength;
        if (error) reject(error);
        else resolve();
      });
    });
  }

  close(finalChunk?: Uint8Array): Promise<void> {
    if (this.closedValue) return Promise.resolve();
    this.closedValue = true;
    if (this.socket.readyState !== WebSocket.OPEN) {
      // 已关闭/正在关闭：close 事件不会再可靠触发，直接断开
      this.socket.terminate();
      return Promise.resolve();
    }
    const finished = new Promise<void>((resolve) => {
      this.socket.once("close", () => resolve());
    });
    if (finalChunk !== undefined) {
      // 先冲刷 final 帧再发 close 帧，保证对端收到完整结尾
      this.socket.send(finalChunk, () => this.socket.close(1000));
    } else {
      this.socket.close(1000);
    }
    // 对端不确认关闭时强制断开，避免挂起
    const timer = setTimeout(() => this.socket.terminate(), GRACEFUL_CLOSE_TIMEOUT_MS);
    timer.unref();
    return finished.then(() => clearTimeout(timer));
  }
}

function toUint8Array(data: RawData): Uint8Array {
  if (Array.isArray(data)) return Buffer.concat(data);
  return new Uint8Array(data);
}
