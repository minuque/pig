import { randomUUID } from "crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import {
  CommandConflictError,
  SingleActiveRunStrategyImpl,
  type CommandId,
  type LocalIdentityId,
  type PiRuntimeAdapter,
  type PlatformPort,
  type RunRepository,
  type SessionId,
  type SingleActiveRunStrategy,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";
import { NodePlatformPort } from "../adapters/filesystem/node-platform.js";
import { PiRuntimeAdapterImpl } from "../adapters/pi/runtime.js";
import { InMemoryRunRepository } from "../adapters/repositories/run-repository.js";
import { ActiveRunConflictError, RunNotFoundError, RunsApplication } from "../application/runs.js";
import { SessionNotFoundError, SessionsApplication } from "../application/sessions.js";
import {
  SingleWorkspaceConflictError,
  WorkspaceAccessDeniedError,
  WorkspacesApplication,
} from "../application/workspaces.js";

export interface GatewayOptions {
  platformPort?: PlatformPort;
  runtimeAdapter?: PiRuntimeAdapter;
  bootstrapSecret?: string;
  bootstrapTtlMs?: number;
  runRepository?: RunRepository;
  activeRunStrategy?: SingleActiveRunStrategy;
}

export class Gateway {
  private readonly server = createServer(this.handleRequest.bind(this));
  private readonly bootstrapSecret: string;
  private readonly bootstrapExpiresAt: number;
  private bootstrapUsed = false;
  private port = 0;
  private readonly credentials = new Map<string, LocalIdentityId>();
  private readonly eventClients = new Map<ServerResponse, LocalIdentityId>();
  private readonly workspaces: WorkspacesApplication;
  private readonly sessions: SessionsApplication;
  private readonly runs: RunsApplication;

  constructor(options: GatewayOptions = {}) {
    const runtime = options.runtimeAdapter ?? new PiRuntimeAdapterImpl();
    this.bootstrapSecret = options.bootstrapSecret ?? randomUUID();
    this.bootstrapExpiresAt = Date.now() + (options.bootstrapTtlMs ?? 60_000);
    this.workspaces = new WorkspacesApplication(options.platformPort ?? new NodePlatformPort());
    this.sessions = new SessionsApplication(this.workspaces, runtime);
    this.runs = new RunsApplication(
      this.sessions,
      runtime,
      options.runRepository ?? new InMemoryRunRepository(),
      options.activeRunStrategy ?? new SingleActiveRunStrategyImpl(),
      (workspaceId, event) => {
        const message = `data: ${JSON.stringify(event)}\n\n`;
        for (const [client, identityId] of this.eventClients)
          if (this.workspaces.hasAccess(identityId, workspaceId)) client.write(message);
      },
    );
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

  private identity(req: IncomingMessage) {
    const header = req.headers.authorization;
    return header?.startsWith("Bearer ") ? this.credentials.get(header.slice(7)) : undefined;
  }

  private error(res: ServerResponse, error: unknown) {
    if (error instanceof CommandConflictError)
      return this.send(res, 409, { code: "COMMAND_ID_CONFLICT" });
    if (error instanceof SingleWorkspaceConflictError)
      return this.send(res, 409, { code: "SINGLE_WORKSPACE_LIMIT" });
    if (error instanceof ActiveRunConflictError)
      return this.send(res, 409, { code: "ACTIVE_RUN_LIMIT" });
    if (error instanceof WorkspaceAccessDeniedError)
      return this.send(res, 403, { code: "WORKSPACE_ACCESS_DENIED" });
    if (error instanceof SessionNotFoundError)
      return this.send(res, 404, { code: "SESSION_NOT_FOUND" });
    if (error instanceof RunNotFoundError) return this.send(res, 404, { code: "RUN_NOT_FOUND" });
    return this.send(res, 400, { code: "INVALID_REQUEST" });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/health" && req.method === "GET")
      return this.send(res, 200, { status: "ok" });
    if (url.pathname === "/api/v1/bootstrap" && req.method === "POST") {
      try {
        const { secret } = await this.body(req);
        if (
          typeof secret !== "string" ||
          secret !== this.bootstrapSecret ||
          this.bootstrapUsed ||
          Date.now() >= this.bootstrapExpiresAt
        )
          return this.send(res, 401, { code: "INVALID_BOOTSTRAP" });
        this.bootstrapUsed = true;
        const credential = randomUUID();
        const identityId = randomUUID() as LocalIdentityId;
        this.credentials.set(credential, identityId);
        return this.send(res, 201, { credential, identityId });
      } catch {
        return this.send(res, 400, { code: "INVALID_REQUEST" });
      }
    }
    if (!url.pathname.startsWith("/api/v1/")) return this.send(res, 404);
    const identityId = this.identity(req);
    if (!identityId) return this.send(res, 401, { code: "UNAUTHENTICATED" });
    if (url.pathname === "/api/v1/events" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      this.eventClients.set(res, identityId);
      res.on("close", () => this.eventClients.delete(res));
      return;
    }

    try {
      if (url.pathname === "/api/v1/workspaces/preview" && req.method === "POST") {
        const { path } = await this.body(req);
        if (typeof path !== "string" || !path.trim()) throw new Error();
        return this.send(res, 200, { canonicalPath: await this.workspaces.preview(path) });
      }
      if (url.pathname === "/api/v1/workspaces/confirm" && req.method === "POST") {
        const { path, name, commandId } = await this.body(req);
        if (
          typeof path !== "string" ||
          !path.trim() ||
          typeof commandId !== "string" ||
          !commandId.trim() ||
          (name !== undefined && (typeof name !== "string" || !name.trim()))
        )
          throw new Error();
        return this.send(res, 201, {
          workspace: await this.workspaces.confirm(
            identityId,
            path,
            name as string | undefined,
            commandId as CommandId,
          ),
        });
      }
      if (url.pathname === "/api/v1/workspaces" && req.method === "GET")
        return this.send(res, 200, { workspaces: this.workspaces.list(identityId) });
      const workspaceMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)$/);
      if (workspaceMatch && req.method === "GET")
        return this.send(res, 200, {
          workspace: this.workspaces.get(identityId, workspaceMatch[1] as WorkspaceId),
        });

      const sessionsMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/sessions$/);
      if (sessionsMatch) {
        const workspaceId = sessionsMatch[1] as WorkspaceId;
        if (req.method === "GET")
          return this.send(res, 200, {
            sessions: await this.sessions.list(identityId, workspaceId),
          });
        if (req.method === "POST") {
          const { commandId, name } = await this.body(req);
          if (
            typeof commandId !== "string" ||
            !commandId.trim() ||
            (name !== undefined && (typeof name !== "string" || !name.trim()))
          )
            throw new Error();
          return this.send(res, 201, {
            session: await this.sessions.create(
              identityId,
              workspaceId,
              name as string | undefined,
              commandId as CommandId,
            ),
          });
        }
      }

      const runsMatch = url.pathname.match(
        /^\/api\/v1\/workspaces\/([^/]+)\/sessions\/([^/]+)\/runs(?:\/([^/]+)(\/cancel)?)?$/,
      );
      if (runsMatch) {
        const workspaceId = runsMatch[1] as WorkspaceId;
        const sessionId = runsMatch[2] as SessionId;
        if (req.method === "GET" && runsMatch[3] && !runsMatch[4])
          return this.send(res, 200, {
            run: await this.runs.get(identityId, workspaceId, sessionId, runsMatch[3]),
          });
        if (req.method === "POST" && runsMatch[3] && runsMatch[4]) {
          const { commandId } = await this.body(req);
          if (typeof commandId !== "string" || !commandId.trim()) throw new Error();
          return this.send(res, 200, {
            run: await this.runs.cancel(
              identityId,
              workspaceId,
              sessionId,
              runsMatch[3],
              commandId as CommandId,
            ),
          });
        }
        if (req.method === "POST" && !runsMatch[3]) {
          const { commandId, prompt } = await this.body(req);
          if (
            typeof commandId !== "string" ||
            !commandId.trim() ||
            typeof prompt !== "string" ||
            !prompt.trim()
          )
            throw new Error();
          return this.send(res, 201, {
            run: await this.runs.create(
              identityId,
              workspaceId,
              sessionId,
              prompt,
              commandId as CommandId,
            ),
          });
        }
      }

      const sessionMatch = url.pathname.match(
        /^\/api\/v1\/workspaces\/([^/]+)\/sessions\/([^/]+)(\/transcript)?$/,
      );
      if (sessionMatch && req.method === "GET") {
        const workspaceId = sessionMatch[1] as WorkspaceId;
        const sessionId = sessionMatch[2] as SessionId;
        return sessionMatch[3]
          ? this.send(res, 200, {
              transcript: await this.sessions.transcript(identityId, workspaceId, sessionId),
            })
          : this.send(res, 200, {
              session: await this.sessions.get(identityId, workspaceId, sessionId),
            });
      }
      return this.send(res, 404);
    } catch (error) {
      return this.error(res, error);
    }
  }

  async start() {
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
    for (const client of this.eventClients.keys()) client.end();
    this.eventClients.clear();
    return new Promise<void>((resolveStop, reject) =>
      this.server.close((error) => (error ? reject(error) : resolveStop())),
    );
  }

  getPort() {
    return this.port;
  }
}

export default Gateway;
