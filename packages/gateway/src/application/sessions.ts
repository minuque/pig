import {
  InMemoryCommandExecutor,
  type CommandId,
  type LocalIdentityId,
  type PiRuntimeAdapter,
  type SessionId,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";
import { WorkspacesApplication } from "./workspaces.js";

export class SessionNotFoundError extends Error {}

export class SessionsApplication {
  private readonly commands = new InMemoryCommandExecutor();

  constructor(
    private readonly workspaces: WorkspacesApplication,
    private readonly runtime: PiRuntimeAdapter,
  ) {}

  async list(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    return this.runtime.discoverSessions(this.workspaces.get(identityId, workspaceId));
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
    const session = (await this.list(identityId, workspaceId)).find(({ id }) => id === sessionId);
    if (!session) throw new SessionNotFoundError();
    return session;
  }

  async transcript(identityId: LocalIdentityId, workspaceId: WorkspaceId, sessionId: SessionId) {
    await this.get(identityId, workspaceId, sessionId);
    return this.runtime.readTranscript(this.workspaces.get(identityId, workspaceId), sessionId);
  }
}
