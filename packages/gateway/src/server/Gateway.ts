import { randomUUID } from "crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import {
  CommandConflictError,
  type CommandId,
  type ErrorCode,
  type LocalIdentityId,
  type PiRuntimeAdapter,
  type PlatformPort,
  type RunRepository,
  type SessionId,
  type SSEEventEnvelope,
  type WorkspaceId,
} from "@pig/contracts";
import { NodePlatformPort } from "../adapters/filesystem/node-platform.js";
import { PiRuntimeAdapterImpl } from "../adapters/pi/runtime.js";
import { InMemoryRunRepository } from "../adapters/repositories/run-repository.js";
import {
  InvalidModelPresetError,
  InvalidRunStateError,
  RunNotFoundError,
  RunsApplication,
} from "../application/runs.js";
import { SqliteMetadataStore } from "../adapters/repositories/metadata-store.js";
import {
  InvalidSessionCursorError,
  SessionNotFoundError,
  SessionsApplication,
} from "../application/sessions.js";
import { WorkspaceAccessDeniedError, WorkspacesApplication } from "../application/workspaces.js";
import { serveWebFile } from "./static-files.js";

export class EventBuffer {
  private readonly buffer: SSEEventEnvelope[] = [];
  constructor(private readonly capacity = 1000) {}
  push(event: SSEEventEnvelope) {
    this.buffer.push(event);
    if (this.buffer.length > this.capacity) this.buffer.shift();
  }
  replayAfter(seq: number): SSEEventEnvelope[] | undefined {
    const idx = this.buffer.findIndex((e) => e.sequence === seq);
    if (idx === -1) return undefined;
    return this.buffer.slice(idx + 1);
  }
}

export interface GatewayOptions {
  platformPort?: PlatformPort;
  runtimeAdapter?: PiRuntimeAdapter;
  bootstrapSecret?: string;
  bootstrapTtlMs?: number;
  runRepository?: RunRepository;
  dbPath?: string;
  maxConcurrentRuns?: number;
  webRoot?: string;
}

export class Gateway {
  private readonly server = createServer(this.handleRequest.bind(this));
  private readonly bootstrapSecret: string;
  private readonly bootstrapExpiresAt: number;
  private readonly webRoot: string | undefined;
  private bootstrapUsed = false;
  private port = 0;
  private readonly credentials = new Map<string, LocalIdentityId>();
  private readonly eventClients = new Map<ServerResponse, LocalIdentityId>();
  private readonly workspaces: WorkspacesApplication;
  private readonly sessions: SessionsApplication;
  private readonly runs: RunsApplication;
  private readonly metadata: SqliteMetadataStore;
  private readonly closesMetadata: boolean;
  private readonly eventBuffer = new EventBuffer(1000);
  private sequence = 1;
  private readonly statusMap: Record<ErrorCode, number> = {
    COMMAND_ID_CONFLICT: 409,
    INVALID_MODEL_PRESET: 400,
    INVALID_SESSION_CURSOR: 400,
    INVALID_RUN_STATE: 409,
    WORKSPACE_ACCESS_DENIED: 403,
    SESSION_NOT_FOUND: 404,
    RUN_NOT_FOUND: 404,
    INVALID_BOOTSTRAP: 401,
    UNAUTHENTICATED: 401,
  };

  constructor(options: GatewayOptions = {}) {
    const runtime = options.runtimeAdapter ?? new PiRuntimeAdapterImpl();
    this.bootstrapSecret = options.bootstrapSecret ?? randomUUID();
    this.bootstrapExpiresAt = Date.now() + (options.bootstrapTtlMs ?? 60_000);
    this.webRoot = options.webRoot;
    this.metadata = new SqliteMetadataStore(options.dbPath);
    this.closesMetadata = options.dbPath !== undefined;
    this.workspaces = new WorkspacesApplication(
      options.platformPort ?? new NodePlatformPort(),
      this.metadata,
      runtime,
    );
    this.sessions = new SessionsApplication(this.workspaces, runtime, this.metadata);
    this.runs = new RunsApplication(
      this.sessions,
      runtime,
      options.runRepository ?? new InMemoryRunRepository(),
      (workspaceId, event) => {
        event.sequence = ++this.sequence;
        this.eventBuffer.push(event);
        const message = `data: ${JSON.stringify(event)}\n\n`;
        for (const [client, identityId] of this.eventClients)
          if (this.workspaces.hasAccess(identityId, workspaceId)) client.write(message);
      },
      options.maxConcurrentRuns ?? 2,
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
    let code: ErrorCode | undefined;
    if (error instanceof CommandConflictError) {
      code = "COMMAND_ID_CONFLICT";
    } else if (error instanceof Error && "code" in error) {
      code = error.code as ErrorCode;
    }
    if (!code) {
      console.error("Unhandled error:", error);
      return this.send(res, 500, { code: "INVALID_REQUEST" });
    }
    const status = this.statusMap[code] ?? 500;
    return this.send(res, status, { code });
  }

  private requireString(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      const err = new Error("invalid field");
      (err as any).code = "INVALID_REQUEST";
      throw err;
    }
    return value.trim();
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
        if (
          typeof secret !== "string" ||
          secret !== this.bootstrapSecret ||
          this.bootstrapUsed ||
          Date.now() >= this.bootstrapExpiresAt
        )
          return this.send(res, 401, { code: "INVALID_BOOTSTRAP" });
        this.bootstrapUsed = true;
        const credential = randomUUID();
        const identityId = this.metadata.identity();
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
      let replay: SSEEventEnvelope[] | undefined = undefined;
      const lastEventId = req.headers["last-event-id"] as string | undefined;
      if (typeof lastEventId === "string") {
        const s = Number(lastEventId);
        if (!isNaN(s)) replay = this.eventBuffer.replayAfter(s);
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...(replay === undefined ? { "X-Event-Stream-Gap": "1" } : {}),
      });
      if (replay !== undefined) {
        for (const event of replay) {
          if (this.workspaces.hasAccess(identityId, event.workspaceId)) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        }
      } else {
        res.write(": connected\n\n");
      }
      this.eventClients.set(res, identityId);
      res.on("close", () => this.eventClients.delete(res));
      return;
    }

    try {
      if (url.pathname === "/api/v1/workspaces/select-directory" && req.method === "POST")
        return this.send(res, 200, { path: (await this.workspaces.selectDirectory()) ?? null });
      if (url.pathname === "/api/v1/workspaces/preview" && req.method === "POST") {
        const { path } = await this.body(req);
        const pathStr = this.requireString(path);
        return this.send(res, 200, { canonicalPath: await this.workspaces.preview(pathStr) });
      }
      if (url.pathname === "/api/v1/workspaces/confirm" && req.method === "POST") {
        const { path, name, commandId } = await this.body(req);
        if (typeof path !== "string" || !path.trim()) throw new Error();
        const cmdId = this.requireString(commandId);
        const nameStr = name !== undefined ? this.requireString(name) : undefined;
        return this.send(res, 201, {
          workspace: await this.workspaces.confirm(identityId, path, nameStr, cmdId as CommandId),
        });
      }
      if (url.pathname === "/api/v1/workspaces" && req.method === "GET")
        return this.send(res, 200, { workspaces: this.workspaces.list(identityId) });
      if (url.pathname === "/api/v1/workspaces/candidates" && req.method === "GET")
        return this.send(res, 200, { candidates: await this.workspaces.candidates(identityId) });
      if (url.pathname === "/api/v1/capabilities" && req.method === "GET")
        return this.send(res, 200, await this.runs.capabilities());
      const workspaceMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)$/);
      if (workspaceMatch && req.method === "DELETE") {
        const { confirm } = await this.body(req);
        if (confirm !== true) throw new Error();
        this.workspaces.revoke(identityId, workspaceMatch[1] as WorkspaceId);
        return this.send(res, 204);
      }
      if (workspaceMatch && req.method === "GET")
        return this.send(res, 200, {
          workspace: this.workspaces.get(identityId, workspaceMatch[1] as WorkspaceId),
        });

      const sessionsMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/sessions$/);
      if (sessionsMatch) {
        const workspaceId = sessionsMatch[1] as WorkspaceId;
        if (req.method === "GET")
          return this.send(res, 200, {
            ...(await this.sessions.list(
              identityId,
              workspaceId,
              url.searchParams.get("cursor") ?? undefined,
              Number(url.searchParams.get("limit") ?? 50),
            )),
          });
        if (req.method === "POST") {
          const { commandId, name } = await this.body(req);
          const cmdId = this.requireString(commandId);
          const nameStr = name !== undefined ? this.requireString(name) : undefined;
          return this.send(res, 201, {
            session: await this.sessions.create(
              identityId,
              workspaceId,
              nameStr,
              cmdId as CommandId,
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
          const cmdId = this.requireString(commandId);
          return this.send(res, 200, {
            run: await this.runs.cancel(
              identityId,
              workspaceId,
              sessionId,
              runsMatch[3],
              cmdId as CommandId,
            ),
          });
        }
        if (req.method === "POST" && !runsMatch[3]) {
          const { commandId, prompt, profile } = await this.body(req);
          const cmdId = this.requireString(commandId);
          const promptStr = this.requireString(prompt);
          return this.send(res, 201, {
            run: await this.runs.create(
              identityId,
              workspaceId,
              sessionId,
              promptStr,
              cmdId as CommandId,
              profile as import("@pig/contracts").ModelPreset | undefined,
            ),
          });
        }
      }

      const steerMatch = url.pathname.match(
        /^\/api\/v1\/workspaces\/([^/]+)\/sessions\/([^/]+)\/runs\/([^/]+)\/steer$/,
      );
      if (steerMatch && req.method === "POST") {
        const { input } = await this.body(req);
        const inputStr = this.requireString(input);
        return this.send(res, 200, {
          run: await this.runs.steer(
            identityId,
            steerMatch[1] as WorkspaceId,
            steerMatch[2] as SessionId,
            steerMatch[3]!,
            inputStr,
          ),
        });
      }
      const sessionMatch = url.pathname.match(
        /^\/api\/v1\/workspaces\/([^/]+)\/sessions\/([^/]+)(\/transcript)?$/,
      );
      if (sessionMatch && req.method === "PATCH") {
        const { name, confirm } = await this.body(req);
        if (confirm !== true || typeof name !== "string" || !name.trim()) throw new Error();
        const nameStr = this.requireString(name);
        return this.send(res, 200, {
          session: await this.sessions.rename(
            identityId,
            sessionMatch[1] as WorkspaceId,
            sessionMatch[2] as SessionId,
            nameStr,
          ),
        });
      }
      if (sessionMatch && req.method === "DELETE") {
        const { confirm } = await this.body(req);
        if (confirm !== true) throw new Error();
        return this.send(
          res,
          200,
          await this.sessions.delete(
            identityId,
            sessionMatch[1] as WorkspaceId,
            sessionMatch[2] as SessionId,
          ),
        );
      }
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
    try {
      await new Promise<void>((resolveStop, reject) =>
        this.server.close((error) => (error ? reject(error) : resolveStop())),
      );
    } finally {
      if (this.closesMetadata) this.metadata.close();
    }
  }

  getPort() {
    return this.port;
  }
}

export default Gateway;
