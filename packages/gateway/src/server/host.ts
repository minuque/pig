import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { PiServer } from "@earendil-works/pi-server"
import { PiHostService, type PiHostServiceOptions } from "../pi/service.js"
import { ManualDirectoryPort, WindowsDirectoryPort, type DirectoryPort } from "../directory.js"
import { handlePlatformRequest } from "./platform.js"
import { installProviderHttp } from "./provider-http.js"
import { serveWebFile } from "./static-files.js"
import { createWebSocketListener } from "./websocket.js"

export interface GatewayOptions {
  webRoot?: string
  sessionDir?: string
  cwd?: string
  /** 目录选择平台端口，测试可注入假件。 */
  platformPort?: DirectoryPort
  /** HTTP 监听端口。缺省 0，由系统分配。 */
  port?: number
  /** 测试注入：ModelRuntime 工厂。 */
  createRuntime?: PiHostServiceOptions["createRuntime"]
}

/**
 * Thin Host：本地 HTTP 壳（health / 静态 SPA / 目录选择）
 * + 只绑 127.0.0.1 的 WebSocket listener，连接直接交给官方 PiServer + PiHostService。
 */
export class Gateway {
  private readonly server = createServer(this.handleRequest.bind(this))
  private readonly hostService: PiHostService
  private readonly piServer: PiServer
  private readonly webRoot: string | undefined
  private readonly platformPort: DirectoryPort
  private readonly listenPort: number

  constructor(options: GatewayOptions = {}) {
    this.webRoot = options.webRoot
    this.listenPort = options.port ?? 0
    this.platformPort =
      options.platformPort ??
      (process.platform === "win32" ? new WindowsDirectoryPort() : new ManualDirectoryPort())

    this.hostService = new PiHostService({
      ...(options.sessionDir ? { sessionDir: options.sessionDir } : {}),
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.createRuntime ? { createRuntime: options.createRuntime } : {}),
    })
    this.piServer = new PiServer(this.hostService, {
      listeners: [createWebSocketListener({ server: this.server })],
      onError: (error) => console.error("PiServer error:", error),
      handshakeTimeoutMs: 30_000,
    })
  }

  private send(res: ServerResponse, status: number, body?: unknown) {
    res.writeHead(status, body === undefined ? {} : { "Content-Type": "application/json" })
    res.end(body === undefined ? undefined : JSON.stringify(body))
  }

  private async body(req: IncomingMessage): Promise<Record<string, unknown>> {
    let raw = ""

    for await (const chunk of req) {
      raw += chunk

      if (raw.length > 1_000_000) throw new Error("body too large")
    }

    const parsed: unknown = JSON.parse(raw)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid body")

    return parsed as Record<string, unknown>
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")

    if (url.pathname === "/health" && req.method === "GET")
      return this.send(res, 200, { status: "ok" })

    if (
      this.webRoot &&
      req.method === "GET" &&
      !url.pathname.startsWith("/api/") &&
      (await serveWebFile(
        this.webRoot,
        url.pathname,
        res,
        typeof req.headers["accept-encoding"] === "string" ? req.headers["accept-encoding"] : "",
      ))
    )
      return

    if (url.pathname.startsWith("/api/v1/platform/")) {
      const handled = await handlePlatformRequest(req, res, url, {
        send: this.send.bind(this),
        body: this.body.bind(this),
        hostService: this.hostService,
        platformPort: this.platformPort,
      })

      if (handled) return
    }

    return this.send(res, 404)
  }

  async start() {
    installProviderHttp()
    await this.hostService.warm()
    await this.piServer.start()

    return new Promise<number>((resolveStart, reject) => {
      this.server.once("error", reject)
      this.server.listen(this.listenPort, "127.0.0.1", () => {
        this.server.off("error", reject)
        const address = this.server.address()

        if (!address || typeof address === "string" || address.port === 0) {
          reject(new Error("Gateway HTTP server has no TCP port"))

          return
        }

        resolveStart(address.port)
      })
    })
  }

  async stop() {
    await this.piServer.close()
    await new Promise<void>((resolveStop, reject) =>
      this.server.close((error) => (error ? reject(error) : resolveStop())),
    )
  }
}

export default Gateway
