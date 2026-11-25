import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { closeEnvironments } from "@pig/environment"
import { BrowserSession, browserSecretFile } from "../auth/browser-session.js"
import { PiHostService, type PiHostServiceOptions } from "../pi/service.js"
import {
  ManualDirectoryPort,
  WindowsDirectoryPort,
  type DirectoryPort,
} from "../system/directory.js"
import { PreferencesStore, preferencesFile } from "../system/preferences.js"
import { SessionArchivesStore, sessionArchivesFile } from "../system/session-archives.js"
import { handlePreviewRequest } from "./file-preview.js"
import { handlePlatformRequest, type EnvironmentSources } from "./platform.js"
import { installProviderHttp } from "./provider-http.js"
import { handleProviderRequest } from "./providers.js"
import { serveWebFile } from "./static-files.js"
import { ProtocolServer } from "./websocket.js"

export interface GatewayOptions {
  webRoot?: string
  sessionDir?: string
  pigHome?: string
  cwd?: string
  platformPort?: DirectoryPort
  port?: number
  createRuntime?: PiHostServiceOptions["createRuntime"]
  createSession?: PiHostServiceOptions["createSession"]
  attachmentRootDir?: string
  browserSecretFile?: string
  agentDir?: string
  environments?: EnvironmentSources
  remoteRoot?: string
}

export class Gateway {
  private readonly server = createServer(this.handleRequest.bind(this))
  private readonly hostService: PiHostService
  private readonly protocol: ProtocolServer
  private readonly webRoot: string | undefined
  private readonly platformPort: DirectoryPort
  private readonly listenPort: number
  private readonly browser: BrowserSession
  private readonly environments: EnvironmentSources
  private readonly preferences: PreferencesStore
  private readonly sessionArchives: SessionArchivesStore

  constructor(options: GatewayOptions = {}) {
    this.webRoot = options.webRoot
    this.listenPort = options.port ?? 0
    this.browser = new BrowserSession(
      options.browserSecretFile ?? browserSecretFile(options.sessionDir, options.pigHome),
    )
    this.preferences = new PreferencesStore(preferencesFile(options.sessionDir, options.pigHome))
    this.sessionArchives = new SessionArchivesStore(
      sessionArchivesFile(options.sessionDir, options.pigHome),
    )
    this.environments = options.environments ?? {}
    this.platformPort =
      options.platformPort ??
      (process.platform === "win32" ? new WindowsDirectoryPort() : new ManualDirectoryPort())

    this.hostService = new PiHostService({
      ...(options.sessionDir ? { sessionDir: options.sessionDir } : {}),
      ...(options.pigHome ? { pigHome: options.pigHome } : {}),
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.attachmentRootDir ? { attachmentRootDir: options.attachmentRootDir } : {}),
      ...(options.agentDir ? { agentDir: options.agentDir } : {}),
      ...(options.remoteRoot ? { remoteRoot: options.remoteRoot } : {}),
      ...(options.createRuntime ? { createRuntime: options.createRuntime } : {}),
      ...(options.createSession ? { createSession: options.createSession } : {}),
    })
    this.protocol = new ProtocolServer({
      server: this.server,
      service: this.hostService,
      workspaceGit: this.hostService.workspaceGit,
      allow: (req) => this.browser.rejection(req.headers),
      onError: (error) => console.error("Gateway protocol error:", error),
    })
    this.hostService.onCatalogChange = () => this.protocol.broadcastServerSnapshot()
  }

  get launchToken(): string {
    return this.browser.launchToken
  }

  authorizationHeader(): string {
    return this.browser.authorizationHeader()
  }

  authenticatedUrl(base: string): string {
    return this.browser.authenticatedUrl(base)
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

    const method = req.method ?? "GET"
    const exchanging = method === "GET" && url.pathname === "/" && url.searchParams.has("token")

    if (exchanging || (this.webRoot && isAppShell(url.pathname, method))) {
      if (!this.browser.authorizeIndex(req, res)) return
    }

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

    if (
      await handlePreviewRequest(req, res, url, {
        send: this.send.bind(this),
        hostService: this.hostService,
      })
    )
      return

    if (url.pathname.startsWith("/api/")) {
      const rejection = this.browser.rejection(req.headers)

      if (rejection)
        return this.send(res, rejection, {
          code: rejection === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
        })
    }

    if (url.pathname.startsWith("/api/v1/platform/")) {
      const providerHandled = await handleProviderRequest(req, res, url, {
        send: this.send.bind(this),
        body: this.body.bind(this),
        providers: this.hostService.providers,
      })

      if (providerHandled) return

      const handled = await handlePlatformRequest(req, res, url, {
        send: this.send.bind(this),
        body: this.body.bind(this),
        hostService: this.hostService,
        platformPort: this.platformPort,
        environments: this.environments,
        preferences: this.preferences,
        sessionArchives: this.sessionArchives,
      })

      if (handled) return
    }

    return this.send(res, 404)
  }

  async start() {
    await this.browser.open()
    installProviderHttp()
    this.preferences.watch((preferences) => this.protocol.broadcastPreferences(preferences))
    this.sessionArchives.watch((archives) => this.protocol.broadcastSessionArchives(archives))
    this.hostService.workspaceGit.onChange((changes) =>
      this.protocol.broadcastWorkspaceGit(changes),
    )
    await this.hostService.workspaceGit.load()
    const warming = this.hostService.warm()
    const port = await new Promise<number>((resolveStart, reject) => {
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

    void warming.catch((error) => console.error("host warm failed:", error))
    return port
  }

  async stop() {
    this.preferences.close()
    this.sessionArchives.close()
    await this.protocol.close()
    await this.hostService.dispose()
    await closeEnvironments()

    const closed = new Promise<void>((resolveStop, reject) =>
      this.server.close((error) => (error ? reject(error) : resolveStop())),
    )

    // 外部：停止期间新连上、还没发完请求的客户端不会自己断，server.close 会一直等它
    this.server.closeAllConnections()
    await closed
  }
}

function isAppShell(pathname: string, method: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false

  if (pathname.startsWith("/api/")) return false
  const last = pathname.split("/").pop() ?? ""
  return last === "" || last === "index.html" || !last.includes(".")
}

export default Gateway
