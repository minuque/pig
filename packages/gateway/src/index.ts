import { randomUUID } from "crypto";
import { appendFile, readFile, realpath } from "fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { resolve } from "path";

import {
  CommandConflictError,
  InMemoryCommandExecutor,
  SingleActiveRunStrategyImpl,
  SingleWorkspaceStrategyImpl,
  type CommandId,
  type LocalIdentityId,
  type PiRuntimeAdapter,
  type PlatformPort,
  type Run,
  type RunId,
  type RunRepository,
  type Session,
  type SingleActiveRunStrategy,
  type SessionId,
  type TranscriptEntry,
  type Workspace,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";

interface GatewayOptions {
  platformPort?: PlatformPort;
  runtimeAdapter?: PiRuntimeAdapter;
  bootstrapSecret?: string;
  bootstrapTtlMs?: number;
  runRepository?: RunRepository;
  activeRunStrategy?: SingleActiveRunStrategy;
}

export class NodePlatformPort implements PlatformPort {
  async canonicalizeWorkspacePath(candidatePath: string): Promise<string> {
    return realpath(resolve(candidatePath));
  }
  async getPlatformPath(): Promise<string> {
    return process.platform;
  }
}

class Gateway {
  private readonly server = createServer(this.handleRequest.bind(this));
  private readonly platformPort: PlatformPort;
  private readonly runtimeAdapter: PiRuntimeAdapter;
  private readonly bootstrapSecret: string;
  private readonly bootstrapExpiresAt: number;
  private bootstrapUsed = false;
  private port = 0;
  private readonly credentials = new Map<string, LocalIdentityId>();
  private readonly workspaceAccess = new Map<LocalIdentityId, Set<WorkspaceId>>();
  private readonly workspaces = new Map<WorkspaceId, Workspace>();
  private readonly workspacePolicy = new SingleWorkspaceStrategyImpl();
  private readonly commands = new InMemoryCommandExecutor();
  private readonly runs: RunRepository;
  private readonly activeRunPolicy: SingleActiveRunStrategy;

  constructor(options: GatewayOptions = {}) {
    this.platformPort = options.platformPort ?? new NodePlatformPort();
    this.runtimeAdapter = options.runtimeAdapter ?? new PiRuntimeAdapterImpl();
    this.bootstrapSecret = options.bootstrapSecret ?? randomUUID();
    this.bootstrapExpiresAt = Date.now() + (options.bootstrapTtlMs ?? 60_000);
    this.runs = options.runRepository ?? new InMemoryRunRepository();
    this.activeRunPolicy = options.activeRunStrategy ?? new SingleActiveRunStrategyImpl();
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

  private identity(req: IncomingMessage): LocalIdentityId | undefined {
    const header = req.headers.authorization;
    return header?.startsWith("Bearer ") ? this.credentials.get(header.slice(7)) : undefined;
  }

  private hasAccess(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    return this.workspaceAccess.get(identityId)?.has(workspaceId) === true;
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

    if (url.pathname === "/api/v1/workspaces/preview" && req.method === "POST") {
      try {
        const { path } = await this.body(req);
        if (typeof path !== "string" || !path.trim()) throw new Error("invalid path");
        const canonicalPath = await this.platformPort.canonicalizeWorkspacePath(path);
        return this.send(res, 200, { canonicalPath });
      } catch {
        return this.send(res, 400, { code: "INVALID_WORKSPACE_PATH" });
      }
    }

    if (url.pathname === "/api/v1/workspaces/confirm" && req.method === "POST") {
      try {
        const { path, name, commandId } = await this.body(req);
        if (
          typeof path !== "string" ||
          !path.trim() ||
          typeof commandId !== "string" ||
          !commandId.trim() ||
          (name !== undefined && (typeof name !== "string" || !name.trim()))
        )
          throw new Error("invalid request");
        const canonicalPath = await this.platformPort.canonicalizeWorkspacePath(path);
        const workspace = await this.commands.execute(
          commandId as CommandId,
          { canonicalPath, name: name ?? "Workspace", identityId },
          async () => {
            const existing = await this.workspacePolicy.getCanonicalWorkspace();
            if (existing && existing.canonicalPath !== canonicalPath)
              throw new SingleWorkspaceConflictError();
            const result =
              existing ??
              ({
                id: randomUUID() as WorkspaceId,
                name: (name as string | undefined) ?? "Workspace",
                canonicalPath,
                createdAt: new Date(),
                updatedAt: new Date(),
              } satisfies Workspace);
            if (!existing) {
              this.workspaces.set(result.id, result);
              await this.workspacePolicy.setCanonicalWorkspace(result);
            }
            const access = this.workspaceAccess.get(identityId) ?? new Set<WorkspaceId>();
            access.add(result.id);
            this.workspaceAccess.set(identityId, access);
            return result;
          },
        );
        return this.send(res, 201, { workspace });
      } catch (error) {
        if (error instanceof CommandConflictError)
          return this.send(res, 409, { code: "COMMAND_ID_CONFLICT" });
        if (error instanceof SingleWorkspaceConflictError)
          return this.send(res, 409, { code: "SINGLE_WORKSPACE_LIMIT" });
        return this.send(res, 400, { code: "INVALID_REQUEST" });
      }
    }

    if (url.pathname === "/api/v1/workspaces" && req.method === "GET") {
      return this.send(res, 200, {
        workspaces: [...this.workspaces.values()].filter((workspace) =>
          this.hasAccess(identityId, workspace.id),
        ),
      });
    }

    const workspaceMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)$/);
    if (workspaceMatch && req.method === "GET") {
      const workspaceId = workspaceMatch[1] as WorkspaceId;
      const workspace = this.workspaces.get(workspaceId);
      if (!workspace || !this.hasAccess(identityId, workspaceId))
        return this.send(res, 403, { code: "WORKSPACE_ACCESS_DENIED" });
      return this.send(res, 200, { workspace });
    }

    const sessionsMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/sessions$/);
    if (sessionsMatch) {
      const workspace = this.authorizedWorkspace(identityId, sessionsMatch[1] as WorkspaceId);
      if (!workspace) return this.send(res, 403, { code: "WORKSPACE_ACCESS_DENIED" });
      if (req.method === "GET")
        return this.send(res, 200, {
          sessions: await this.runtimeAdapter.discoverSessions(workspace),
        });
      if (req.method === "POST") {
        try {
          const { commandId, name } = await this.body(req);
          if (
            typeof commandId !== "string" ||
            !commandId.trim() ||
            (name !== undefined && (typeof name !== "string" || !name.trim()))
          )
            throw new Error();
          const session = await this.commands.execute(
            commandId as CommandId,
            { workspaceId: workspace.id, identityId, name },
            () => this.runtimeAdapter.startSession(workspace, name as string | undefined),
          );
          return this.send(res, 201, { session });
        } catch (error) {
          if (error instanceof CommandConflictError)
            return this.send(res, 409, { code: "COMMAND_ID_CONFLICT" });
          return this.send(res, 400, { code: "INVALID_REQUEST" });
        }
      }
    }

    const runsMatch = url.pathname.match(
      /^\/api\/v1\/workspaces\/([^/]+)\/sessions\/([^/]+)\/runs(?:\/([^/]+))?$/,
    );
    if (runsMatch) {
      const workspace = this.authorizedWorkspace(identityId, runsMatch[1] as WorkspaceId);
      if (!workspace) return this.send(res, 403, { code: "WORKSPACE_ACCESS_DENIED" });
      const sessionId = runsMatch[2] as SessionId;
      const session = (await this.runtimeAdapter.discoverSessions(workspace)).find(
        ({ id }) => id === sessionId,
      );
      if (!session) return this.send(res, 404, { code: "SESSION_NOT_FOUND" });
      if (req.method === "GET" && runsMatch[3]) {
        const run = await this.runs.findById(runsMatch[3]);
        if (!run || run.workspaceId !== workspace.id || run.sessionId !== sessionId)
          return this.send(res, 404, { code: "RUN_NOT_FOUND" });
        return this.send(res, 200, { run });
      }
      if (req.method === "POST" && !runsMatch[3]) {
        try {
          const { commandId, prompt } = await this.body(req);
          if (
            typeof commandId !== "string" ||
            !commandId.trim() ||
            typeof prompt !== "string" ||
            !prompt.trim()
          )
            throw new Error("invalid request");
          const run = await this.commands.execute(
            commandId as CommandId,
            { workspaceId: workspace.id, sessionId, prompt, identityId },
            async () => {
              const now = new Date();
              const admitted: Run = {
                id: randomUUID() as RunId,
                runId: "" as RunId,
                workspaceId: workspace.id,
                sessionId,
                commandId: commandId as CommandId,
                prompt,
                status: "admission",
                createdAt: now,
                updatedAt: now,
              };
              admitted.runId = admitted.id;
              if (!(await this.activeRunPolicy.tryAcquire(admitted)))
                throw new ActiveRunConflictError();
              await this.runs.save(admitted);
              void this.executeRun(admitted);
              return admitted;
            },
          );
          return this.send(res, 201, { run });
        } catch (error) {
          if (error instanceof CommandConflictError)
            return this.send(res, 409, { code: "COMMAND_ID_CONFLICT" });
          if (error instanceof ActiveRunConflictError)
            return this.send(res, 409, { code: "ACTIVE_RUN_LIMIT" });
          return this.send(res, 400, { code: "INVALID_REQUEST" });
        }
      }
    }

    const sessionMatch = url.pathname.match(
      /^\/api\/v1\/workspaces\/([^/]+)\/sessions\/([^/]+)(\/transcript)?$/,
    );
    if (sessionMatch && req.method === "GET") {
      const workspace = this.authorizedWorkspace(identityId, sessionMatch[1] as WorkspaceId);
      if (!workspace) return this.send(res, 403, { code: "WORKSPACE_ACCESS_DENIED" });
      const sessionId = sessionMatch[2] as SessionId;
      const session = (await this.runtimeAdapter.discoverSessions(workspace)).find(
        ({ id }) => id === sessionId,
      );
      if (!session) return this.send(res, 404, { code: "SESSION_NOT_FOUND" });
      if (sessionMatch[3])
        return this.send(res, 200, {
          transcript: await this.runtimeAdapter.readTranscript(workspace, sessionId),
        });
      return this.send(res, 200, { session });
    }

    return this.send(res, 404);
  }

  private async executeRun(run: Run) {
    try {
      const running = await this.runs.save({ ...run, status: "running", updatedAt: new Date() });
      const settled = await this.runtimeAdapter.createRun(
        running.sessionId,
        running.prompt,
        running.commandId,
      );
      await this.runs.save({
        ...running,
        ...settled,
        id: running.id,
        runId: running.id,
        workspaceId: running.workspaceId,
        sessionId: running.sessionId,
        commandId: running.commandId,
        prompt: running.prompt,
        updatedAt: new Date(),
      });
    } catch {
      await this.runs.save({ ...run, status: "failed", updatedAt: new Date() });
    } finally {
      await this.activeRunPolicy.release(run.id);
    }
  }

  private authorizedWorkspace(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    return this.hasAccess(identityId, workspaceId) ? this.workspaces.get(workspaceId) : undefined;
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
    return new Promise<void>((resolveStop, reject) =>
      this.server.close((error) => (error ? reject(error) : resolveStop())),
    );
  }

  getPort() {
    return this.port;
  }
}

class SingleWorkspaceConflictError extends Error {}
class ActiveRunConflictError extends Error {}

const terminalStatuses = new Set<Run["status"]>(["completed", "failed", "cancelled"]);

export class InMemoryRunRepository implements RunRepository {
  private readonly runs = new Map<RunId, Run>();

  async findById(id: string) {
    return this.runs.get(id as RunId);
  }
  async save(run: Run) {
    const previous = this.runs.get(run.id);
    if (previous && terminalStatuses.has(previous.status) && run.status !== previous.status)
      return previous;
    this.runs.set(run.id, run);
    return run;
  }
  async delete(id: string) {
    return this.runs.delete(id as RunId);
  }
  async findAll() {
    return [...this.runs.values()];
  }
}

export default Gateway;

export class PiRuntimeAdapterImpl implements PiRuntimeAdapter {
  constructor(private readonly jsonlPath = "sessions.jsonl") {}

  async startSession(workspace: Workspace, name?: string): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: randomUUID() as SessionId,
      workspaceId: workspace.id,
      ...(name === undefined ? {} : { name }),
      createdAt: now,
      updatedAt: now,
      status: "available",
    };
    await appendFile(
      this.jsonlPath,
      `${JSON.stringify({ type: "session", canonicalPath: workspace.canonicalPath, session })}\n`,
    );
    return session;
  }

  async createRun(
    _sessionId: SessionId,
    _prompt: string,
    _commandId?: CommandId,
  ): Promise<{ status: "completed" | "failed" | "cancelled"; output?: string }> {
    return { status: "completed" };
  }

  async cancelRun(_runId: string): Promise<void> {}

  private async records(): Promise<TranscriptEntry[]> {
    try {
      return (await readFile(this.jsonlPath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as TranscriptEntry);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async discoverSessions(workspace: Workspace): Promise<Session[]> {
    return (await this.records())
      .filter(
        ({ type, canonicalPath }) =>
          type === "session" && canonicalPath === workspace.canonicalPath,
      )
      .map(({ session }) => session as Session)
      .map((session) => ({
        ...session,
        workspaceId: workspace.id,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }));
  }

  async readTranscript(workspace: Workspace, sessionId: SessionId): Promise<TranscriptEntry[]> {
    return (await this.records()).filter(
      ({ type, canonicalPath, sessionId: id }) =>
        type !== "session" && canonicalPath === workspace.canonicalPath && id === sessionId,
    );
  }
}
