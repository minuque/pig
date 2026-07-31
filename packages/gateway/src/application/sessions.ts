import {
  InMemoryCommandExecutor,
  type CommandId,
  type LocalIdentityId,
  type PiRuntimeAdapter,
  type SessionId,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";
import type { SqliteMetadataStore } from "../adapters/repositories/metadata-store.js";
import { WorkspacesApplication } from "./workspaces.js";

export class SessionNotFoundError extends Error {}
export class InvalidSessionCursorError extends Error {}

export class SessionsApplication {
  private readonly commands = new InMemoryCommandExecutor();
  constructor(
    private readonly workspaces: WorkspacesApplication,
    private readonly runtime: PiRuntimeAdapter,
    private readonly metadata: SqliteMetadataStore,
  ) {}
  private async all(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    return (await this.runtime.discoverSessions(this.workspaces.get(identityId, workspaceId)))
      .map((session) => ({
        ...session,
        ...this.metadata.sessionMetadata(workspaceId, session.id),
      }))
      .filter(({ deleted }) => !deleted)
      .map(({ deleted: _deleted, ...session }) => session);
  }
  async list(identityId: LocalIdentityId, workspaceId: WorkspaceId, cursor?: string, limit = 50) {
    const sessions = (await this.all(identityId, workspaceId)).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id),
    );
    let after: { updatedAt: number; id: string } | undefined;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, "base64url").toString()) as typeof after;
        if (!after || !Number.isFinite(after.updatedAt) || typeof after.id !== "string") throw 0;
      } catch {
        throw new InvalidSessionCursorError();
      }
    }
    const eligible = after
      ? sessions.filter(
          (session) =>
            session.updatedAt.getTime() < after.updatedAt ||
            (session.updatedAt.getTime() === after.updatedAt && session.id > after.id),
        )
      : sessions;
    const page = eligible.slice(0, Math.min(Math.max(limit, 1), 100));
    const last = page.at(-1);
    return {
      sessions: page,
      nextCursor:
        page.length < eligible.length && last
          ? Buffer.from(
              JSON.stringify({ updatedAt: last.updatedAt.getTime(), id: last.id }),
            ).toString("base64url")
          : undefined,
    };
  }
  async create(
    identityId: LocalIdentityId,
    workspaceId: WorkspaceId,
    name: string | undefined,
    commandId: CommandId,
  ) {
    const workspace = this.workspaces.get(identityId, workspaceId);
    return this.commands.execute(commandId, { workspaceId, identityId, name }, () =>
      this.runtime.startSession(workspace, name),
    );
  }
  async get(identityId: LocalIdentityId, workspaceId: WorkspaceId, sessionId: SessionId) {
    const session = (await this.all(identityId, workspaceId)).find(({ id }) => id === sessionId);
    if (!session) throw new SessionNotFoundError();
    return session;
  }
  async rename(
    identityId: LocalIdentityId,
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    name: string,
  ) {
    const session = await this.get(identityId, workspaceId, sessionId);
    this.metadata.renameSession(workspaceId, sessionId, name);
    return { ...session, name };
  }
  async delete(identityId: LocalIdentityId, workspaceId: WorkspaceId, sessionId: SessionId) {
    this.workspaces.get(identityId, workspaceId);
    const meta = this.metadata.sessionMetadata(workspaceId, sessionId);
    if (meta.deleted) return { id: sessionId, deleted: true };
    await this.get(identityId, workspaceId, sessionId);
    this.metadata.deleteSession(workspaceId, sessionId);
    return { id: sessionId, deleted: true };
  }
  async transcript(identityId: LocalIdentityId, workspaceId: WorkspaceId, sessionId: SessionId) {
    await this.get(identityId, workspaceId, sessionId);
    return this.runtime.readTranscript(this.workspaces.get(identityId, workspaceId), sessionId);
  }
}
