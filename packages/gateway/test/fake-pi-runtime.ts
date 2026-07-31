import { randomUUID } from "crypto";
import { appendFile, readFile } from "fs/promises";
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

export class FakePiRuntimeAdapter implements PiRuntimeAdapter {
  constructor(protected readonly jsonlPath = "sessions.jsonl") {}
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
  async capabilities() {
    return { profiles: [{ model: "fake/default", thinkingLevel: "off" }] };
  }
  async createRun(
    _workspaceId: WorkspaceId,
    _sessionId: SessionId,
    _prompt: string,
    _commandId?: CommandId,
    _onEvent?: (event: PiRunEvent) => void,
    _profile?: ExecutionProfile,
  ): Promise<{ status: "completed" | "failed" | "cancelled"; output?: string }> {
    return { status: "completed" };
  }
  async cancelRun(_runId: RunId): Promise<void> {}
  async steerRun(_runId: RunId, _input: string): Promise<void> {}
  protected async records(): Promise<TranscriptEntry[]> {
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
