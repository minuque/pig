import { randomUUID } from "crypto";
import type {
  CommandId,
  ModelPreset,
  PiRunEvent,
  PiRuntimeAdapter,
  Run,
  RunId,
  RunRepository,
  Session,
  SessionId,
  SSEEventEnvelope,
  TranscriptEntry,
  Workspace,
  WorkspaceCandidate,
  WorkspaceId,
} from "@no-pi-no-gang/contracts";
import {
  InMemoryRunRepository,
  NodePlatformPort,
  RunsApplication,
  SessionsApplication,
  SqliteMetadataStore,
  WorkspacesApplication,
} from "@no-pi-no-gang/gateway";

type FakeRecord =
  | { kind: "session"; canonicalPath: string; session: Session }
  | { kind: "entry"; canonicalPath: string; sessionId: SessionId; entry: TranscriptEntry };

/** 内存版 Pi Runtime 假件：不落盘，供 application 直连测试复用 */
export class FakePiRuntimeAdapter implements PiRuntimeAdapter {
  protected readonly records: FakeRecord[] = [];
  candidates: WorkspaceCandidate[] = [];

  async discoverCandidateWorkspaces(): Promise<WorkspaceCandidate[]> {
    return this.candidates.map((candidate) => ({ ...candidate }));
  }

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
    this.records.push({ kind: "session", canonicalPath: workspace.canonicalPath, session });
    return session;
  }

  async capabilities() {
    return {
      presets: [{ model: "fake/default", thinkingLevel: "off" }],
      catalog: [
        {
          id: "fake",
          name: "Fake",
          models: [{ id: "default", name: "Default", reasoning: false, thinkingLevels: ["off"] }],
        },
      ],
    };
  }

  async createRun(
    _workspaceId: WorkspaceId,
    _sessionId: SessionId,
    _prompt: string,
    _commandId?: CommandId,
    _onEvent?: (event: PiRunEvent) => void,
    _profile?: ModelPreset,
  ): Promise<{ status: "completed" | "failed" | "cancelled"; output?: string }> {
    return { status: "completed" };
  }

  async cancelRun(_runId: RunId): Promise<void> {}

  async steerRun(_runId: RunId, _input: string): Promise<void> {}

  async discoverSessions(workspace: Workspace): Promise<Session[]> {
    return this.records
      .filter(
        (r): r is Extract<FakeRecord, { kind: "session" }> =>
          r.kind === "session" && r.canonicalPath === workspace.canonicalPath,
      )
      .map(({ session }) => ({ ...session, workspaceId: workspace.id }));
  }

  async readTranscript(workspace: Workspace, sessionId: SessionId): Promise<TranscriptEntry[]> {
    return this.records
      .filter(
        (r): r is Extract<FakeRecord, { kind: "entry" }> =>
          r.kind === "entry" &&
          r.canonicalPath === workspace.canonicalPath &&
          r.sessionId === sessionId,
      )
      .map(({ entry }) => entry);
  }
}

export interface ApplicationsHarness {
  workspaces: WorkspacesApplication;
  sessions: SessionsApplication;
  runs: RunsApplication;
  metadata: SqliteMetadataStore;
  stop(): void;
}

export function createApplications(options?: {
  platformPort?: ConstructorParameters<typeof WorkspacesApplication>[0];
  runtimeAdapter?: PiRuntimeAdapter;
  runRepository?: RunRepository;
  dbPath?: string;
  maxConcurrentRuns?: number;
  emit?: (workspaceId: WorkspaceId, event: SSEEventEnvelope) => void;
}): ApplicationsHarness {
  const {
    platformPort = new NodePlatformPort(),
    runtimeAdapter = new FakePiRuntimeAdapter(),
    runRepository = new InMemoryRunRepository(),
    dbPath,
    maxConcurrentRuns = 2,
    emit = () => {},
  } = options ?? {};

  const metadata = new SqliteMetadataStore(dbPath ?? ":memory:");
  const workspaces = new WorkspacesApplication(platformPort, metadata, runtimeAdapter);
  const sessions = new SessionsApplication(workspaces, runtimeAdapter, metadata);
  const runs = new RunsApplication(
    sessions,
    runtimeAdapter,
    runRepository,
    emit,
    maxConcurrentRuns,
  );

  return {
    workspaces,
    sessions,
    runs,
    metadata,
    stop: () => metadata.close(),
  };
}

export type { Run, RunId } from "@no-pi-no-gang/contracts";
