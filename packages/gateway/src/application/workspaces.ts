import { randomUUID } from "crypto";
import {
  InMemoryCommandExecutor,
  SingleWorkspaceStrategyImpl,
  type CommandId,
  type LocalIdentityId,
  type PlatformPort,
  type Workspace,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";

export class SingleWorkspaceConflictError extends Error {}
export class WorkspaceAccessDeniedError extends Error {}

export class WorkspacesApplication {
  private readonly access = new Map<LocalIdentityId, Set<WorkspaceId>>();
  private readonly workspaces = new Map<WorkspaceId, Workspace>();
  private readonly policy = new SingleWorkspaceStrategyImpl();
  private readonly commands = new InMemoryCommandExecutor();

  constructor(private readonly platform: PlatformPort) {}

  async preview(path: string) {
    return this.platform.canonicalizeWorkspacePath(path);
  }

  async confirm(
    identityId: LocalIdentityId,
    path: string,
    name: string | undefined,
    commandId: CommandId,
  ) {
    const canonicalPath = await this.preview(path);
    return this.commands.execute(
      commandId,
      { canonicalPath, name: name ?? "Workspace", identityId },
      async () => {
        const existing = await this.policy.getCanonicalWorkspace();
        if (existing && existing.canonicalPath !== canonicalPath)
          throw new SingleWorkspaceConflictError();
        const now = new Date();
        const workspace =
          existing ??
          ({
            id: randomUUID() as WorkspaceId,
            name: name ?? "Workspace",
            canonicalPath,
            createdAt: now,
            updatedAt: now,
          } satisfies Workspace);
        if (!existing) {
          this.workspaces.set(workspace.id, workspace);
          await this.policy.setCanonicalWorkspace(workspace);
        }
        const access = this.access.get(identityId) ?? new Set<WorkspaceId>();
        access.add(workspace.id);
        this.access.set(identityId, access);
        return workspace;
      },
    );
  }

  list(identityId: LocalIdentityId) {
    return [...this.workspaces.values()].filter(({ id }) => this.hasAccess(identityId, id));
  }

  get(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !this.hasAccess(identityId, workspaceId))
      throw new WorkspaceAccessDeniedError();
    return workspace;
  }

  hasAccess(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    return this.access.get(identityId)?.has(workspaceId) === true;
  }
}
