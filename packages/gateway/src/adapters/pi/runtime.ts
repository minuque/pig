import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import type {
  CommandId,
  ExecutionProfile,
  PiRunEvent,
  PiRuntimeAdapter,
  RunId,
  Session,
  SessionId,
  TranscriptEntry,
  Workspace,
  WorkspaceId,
} from "@no-pi-no-gang/contracts";

type Runtime = Awaited<ReturnType<typeof ModelRuntime.create>>;
type SessionFactory = typeof createAgentSession;
type ActiveRun = {
  cancelled: boolean;
  cancel?: Promise<void>;
  session?: AgentSession;
  ready: Promise<AgentSession>;
  resolve: (session: AgentSession) => void;
  reject: (error: unknown) => void;
};

export class PiRuntimeAdapterImpl implements PiRuntimeAdapter {
  private readonly sessionPaths = new Map<string, string>();
  private readonly activeRuns = new Map<RunId, ActiveRun>();
  private runtimePromise?: Promise<Runtime>;

  constructor(
    private readonly createRuntime: () => Promise<Runtime> = () =>
      ModelRuntime.create({ allowModelNetwork: false }),
    private readonly createSession: SessionFactory = createAgentSession,
    private readonly sessionDir?: string | ((workspace: Workspace) => string),
  ) {}

  private runtime() {
    return (this.runtimePromise ??= this.createRuntime());
  }

  async startSession(workspace: Workspace, name?: string): Promise<Session> {
    const manager = SessionManager.create(
      workspace.canonicalPath,
      this.sessionDirectory(workspace),
    );
    manager.appendSessionInfo(name ?? "");
    const path = manager.getSessionFile();
    const header = manager.getHeader();
    if (!path || !header) throw new Error("Pi did not create a persistent session");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      `${[header, ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      { flag: "wx" },
    );
    const id = manager.getSessionId() as SessionId;
    this.sessionPaths.set(this.sessionKey(workspace.id, id), path);
    const now = new Date();
    return {
      id,
      workspaceId: workspace.id,
      ...(name ? { name } : {}),
      createdAt: now,
      updatedAt: now,
      status: "available",
    };
  }

  async capabilities() {
    const runtime = await this.runtime();
    const profiles: ExecutionProfile[] = [];
    for (const model of await runtime.getAvailable()) {
      const { session } = await this.createSession({
        modelRuntime: runtime,
        model,
        sessionManager: SessionManager.inMemory(),
        noTools: "all",
      });
      try {
        const key = `${model.provider}/${model.id}`;
        for (const thinkingLevel of session.getAvailableThinkingLevels())
          profiles.push({ model: key, thinkingLevel });
      } finally {
        session.dispose();
      }
    }
    return { profiles };
  }

  async createRun(
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    prompt: string,
    runKey?: CommandId,
    onEvent: (event: PiRunEvent) => void = () => undefined,
    profile?: ExecutionProfile,
  ): Promise<{ status: "completed" | "failed" | "cancelled"; output?: string }> {
    const runId = runKey as unknown as RunId;
    let resolve!: (session: AgentSession) => void;
    let reject!: (error: unknown) => void;
    const active: ActiveRun = {
      cancelled: false,
      ready: new Promise<AgentSession>((yes, no) => {
        resolve = yes;
        reject = no;
      }),
      resolve: (session) => resolve(session),
      reject: (error) => reject(error),
    };
    void active.ready.catch(() => undefined);
    this.activeRuns.set(runId, active);
    const path = this.sessionPaths.get(this.sessionKey(workspaceId, sessionId));
    if (!path) {
      const error = new Error(`Unknown Pi session ${sessionId}`);
      active.reject(error);
      this.activeRuns.delete(runId);
      throw error;
    }
    let session: AgentSession;
    try {
      const runtime = await this.runtime();
      const separator = profile?.model.indexOf("/") ?? -1;
      const model =
        profile &&
        runtime.getModel(profile.model.slice(0, separator), profile.model.slice(separator + 1));
      if (!model || !profile) throw new Error("Execution profile is unavailable");
      ({ session } = await this.createSession({
        cwd: SessionManager.open(path).getCwd(),
        modelRuntime: runtime,
        model,
        thinkingLevel: profile.thinkingLevel as Parameters<AgentSession["setThinkingLevel"]>[0],
        sessionManager: SessionManager.open(path),
      }));
      active.session = session;
      active.resolve(session);
    } catch (error) {
      active.reject(error);
      this.activeRuns.delete(runId);
      throw error;
    }
    let output = "";
    const unsubscribe = session.subscribe((event) => {
      const mapped = this.mapEvent(event);
      if (!mapped) return;
      if (mapped.type === "run.output.delta") output += (mapped.data as { text: string }).text;
      onEvent(mapped);
    });
    try {
      if (active.cancelled) await active.cancel;
      else await session.prompt(prompt);
      return {
        status: active.cancelled ? "cancelled" : "completed",
        ...(output ? { output } : {}),
      };
    } catch {
      return {
        status: active.cancelled ? "cancelled" : "failed",
        ...(output ? { output } : {}),
      };
    } finally {
      unsubscribe();
      this.activeRuns.delete(runId);
      session.dispose();
    }
  }

  async cancelRun(runId: RunId): Promise<void> {
    const active = this.activeRuns.get(runId);
    if (!active) throw new Error(`Run ${runId} is not active`);
    active.cancelled = true;
    await (active.cancel ??= active.ready.then((session) => session.abort()));
  }

  async steerRun(runId: RunId, input: string): Promise<void> {
    const active = this.activeRuns.get(runId);
    if (!active) throw new Error(`Run ${runId} is not active`);
    await (await (active.session ?? active.ready)).steer(input);
  }

  async discoverSessions(workspace: Workspace): Promise<Session[]> {
    return (
      await SessionManager.list(workspace.canonicalPath, this.sessionDirectory(workspace))
    ).map((info) => {
      const id = info.id as SessionId;
      this.sessionPaths.set(this.sessionKey(workspace.id, id), info.path);
      return {
        id,
        workspaceId: workspace.id,
        ...(info.name ? { name: info.name } : {}),
        createdAt: info.created,
        updatedAt: info.modified,
        status: "available" as const,
      };
    });
  }

  async readTranscript(workspace: Workspace, sessionId: SessionId): Promise<TranscriptEntry[]> {
    const key = this.sessionKey(workspace.id, sessionId);
    if (!this.sessionPaths.has(key)) await this.discoverSessions(workspace);
    const path = this.sessionPaths.get(key);
    if (!path) return [];
    return SessionManager.open(path)
      .getEntries()
      .map((entry) => ({ ...entry }));
  }

  private sessionKey(workspaceId: WorkspaceId, sessionId: SessionId) {
    return `${workspaceId}:${sessionId}`;
  }

  private sessionDirectory(workspace: Workspace) {
    return typeof this.sessionDir === "function" ? this.sessionDir(workspace) : this.sessionDir;
  }

  private mapEvent(event: AgentSessionEvent): PiRunEvent | undefined {
    if (event.type === "message_update") {
      if (event.assistantMessageEvent.type === "text_delta")
        return { type: "run.output.delta", data: { text: event.assistantMessageEvent.delta } };
      if (event.assistantMessageEvent.type === "thinking_delta")
        return { type: "run.thinking.delta", data: { text: event.assistantMessageEvent.delta } };
    }
    if (event.type === "tool_execution_start")
      return { type: "run.tool.start", data: { name: event.toolName, id: event.toolCallId } };
    if (event.type === "tool_execution_update")
      return { type: "run.tool.update", data: { name: event.toolName, id: event.toolCallId } };
    if (event.type === "tool_execution_end")
      return {
        type: "run.tool.end",
        data: { name: event.toolName, id: event.toolCallId, isError: event.isError },
      };
    return undefined;
  }
}
