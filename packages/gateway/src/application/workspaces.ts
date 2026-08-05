import { randomUUID } from "crypto";
import {
  InMemoryCommandExecutor,
  type CommandId,
  type ErrorCode,
  type LocalIdentityId,
  type PiRuntimeAdapter,
  type PlatformPort,
  type Workspace,
  type WorkspaceId,
} from "@no-pi-no-gang/contracts";
import type { SqliteMetadataStore } from "../adapters/repositories/metadata-store.js";

export class WorkspaceAccessDeniedError extends Error {
  readonly code: ErrorCode = "WORKSPACE_ACCESS_DENIED";
}

export class WorkspacesApplication {
  private readonly commands = new InMemoryCommandExecutor();
  constructor(
    private readonly platform: PlatformPort,
    private readonly metadata: SqliteMetadataStore,
    private readonly runtime: PiRuntimeAdapter,
  ) {}
  async selectDirectory() {
    return this.platform.selectWorkspaceDirectory();
  }
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
        const now = new Date();
        return this.metadata.confirmWorkspace(identityId, {
          id: randomUUID() as WorkspaceId,
          name: name ?? "Workspace",
          canonicalPath,
          createdAt: now,
          updatedAt: now,
        } satisfies Workspace);
      },
    );
  }
  list(identityId: LocalIdentityId) {
    return this.metadata.listWorkspaces(identityId);
  }
  get(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    const workspace = this.metadata.findWorkspace(identityId, workspaceId);
    if (!workspace) throw new WorkspaceAccessDeniedError();
    return workspace;
  }
  hasAccess(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    return Boolean(this.metadata.findWorkspace(identityId, workspaceId));
  }
  revoke(identityId: LocalIdentityId, workspaceId: WorkspaceId) {
    this.get(identityId, workspaceId);
    this.metadata.revokeWorkspace(identityId, workspaceId);
  }
  /** 每请求过滤当前身份已授权目录；revoke 后候选可重新出现 */
  async candidates(identityId: LocalIdentityId) {
    const authorized = new Set(
      this.metadata.listWorkspaces(identityId).map((workspace) => workspace.canonicalPath),
    );
    return (await this.runtime.discoverCandidateWorkspaces()).filter(
      (candidate) => !authorized.has(candidate.canonicalPath),
    );
  }
}
