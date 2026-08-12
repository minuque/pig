import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { PiServer } from "@earendil-works/pi-server";
import { BootstrapAuth } from "../auth/bootstrap.js";
import { PiHostService } from "../pi/service.js";
import { NodeDirectoryPort, type DirectoryPort } from "../native/directory.js";
import { serveWebFile } from "./static-files.js";
import { createWebSocketListener } from "./websocket.js";

export interface GatewayOptions {
  bootstrapSecret?: string;
  bootstrapTtlMs?: number;
  webRoot?: string;
  /** 目录选择平台端口，测试可注入假件。 */
  platformPort?: DirectoryPort;
  maxFrameLength?: number;
  maxPendingBytes?: number;
}

/**
 * Thin Host：本地 HTTP 壳（health / 静态 SPA / bootstrap / 目录选择）
 * + 认证过的 WebSocket listener，连接直接交给官方 PiServer + PiHostService。
 */
export class Gateway {
  private readonly server = createServer(this.handleRequest.bind(this));
  private readonly auth: BootstrapAuth;
  private readonly piServer: PiServer;
  private readonly webRoot: string | undefined;
  private readonly platformPort: DirectoryPort;
  private port = 0;

  constructor(options: GatewayOptions = {}) {
    this.auth = new BootstrapAuth(
      options.bootstrapSecret ?? randomUUID(),
      options.bootstrapTtlMs ?? 60_000,
    );
    this.webRoot = options.webRoot;
    this.platformPort = options.platformPort ?? new NodeDirectoryPort();
    this.piServer = new PiServer(new PiHostService(), {
      listeners: [
        createWebSocketListener({
          server: this.server,
          auth: this.auth,
          ...(options.maxFrameLength !== undefined
            ? { maxFrameLength: options.maxFrameLength }
            : {}),
          ...(options.maxPendingBytes !== undefined
            ? { maxPendingBytes: options.maxPendingBytes }
            : {}),
        }),
      ],
      ...(options.maxFrameLength !== undefined ? { maxFrameLength: options.maxFrameLength } : {}),
      onError: (error) => console.error("PiServer error:", error),
    });
  }

  private send(res: ServerResponse, status: number, body?: unknown) {
    res.writeHead(status, body === undefined ? {} : { "Content-Type": "application/json" });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  }

  private async body(req: IncomingMessage): Promise<Record<string, unknown>> {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 1_000_000) throw new Error("body too large");
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid body");
    return parsed as Record<string, unknown>;
  }

  private credential(req: IncomingMessage): string | undefined {
    const header = req.headers.authorization;
    return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/health" && req.method === "GET")
      return this.send(res, 200, { status: "ok" });
    if (
      this.webRoot &&
      req.method === "GET" &&
      !url.pathname.startsWith("/api/") &&
      (await serveWebFile(this.webRoot, url.pathname, res))
    )
      return;
    if (url.pathname === "/api/v1/bootstrap" && req.method === "POST") {
      try {
        const { secret } = await this.body(req);
        const credential = typeof secret === "string" ? this.auth.exchange(secret) : undefined;
        if (!credential) return this.send(res, 401, { code: "INVALID_BOOTSTRAP" });
        return this.send(res, 201, { credential });
      } catch {
        return this.send(res, 400, { code: "INVALID_REQUEST" });
      }
    }
    if (url.pathname === "/api/v1/platform/select-directory" && req.method === "POST") {
      if (!this.auth.verify(this.credential(req)))
        return this.send(res, 401, { code: "UNAUTHENTICATED" });
      try {
        return this.send(res, 200, { path: (await this.platformPort.selectDirectory()) ?? null });
      } catch (error) {
        console.error("select-directory failed:", error);
        return this.send(res, 500, { code: "INVALID_REQUEST" });
      }
    }
    return this.send(res, 404);
  }

  async start() {
    await this.piServer.start();
    return new Promise<number>((resolveStart, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        this.port = (this.server.address() as { port: number }).port;
        resolveStart(this.port);
      });
    });
  }

  async stop() {
    await this.piServer.close();
    await new Promise<void>((resolveStop, reject) =>
      this.server.close((error) => (error ? reject(error) : resolveStop())),
    );
  }

  getPort() {
    return this.port;
  }
}

export default Gateway;
