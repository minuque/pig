import { randomUUID } from "crypto";
import { DatabaseSync } from "node:sqlite";
import type { LocalIdentityId, SessionId, Workspace, WorkspaceId } from "@pig/contracts";

export class SqliteMetadataStore {
  private readonly db: DatabaseSync;
  private closed = false;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS local_identity (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS workspace (
        id TEXT PRIMARY KEY, canonical_path TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_access (
        identity_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
        PRIMARY KEY(identity_id, workspace_id)
      );
      CREATE TABLE IF NOT EXISTS session_metadata (
        workspace_id TEXT NOT NULL, session_id TEXT NOT NULL, name TEXT,
        deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(workspace_id, session_id)
      );
    `);
  }

  identity() {
    const row = this.db.prepare("SELECT id FROM local_identity LIMIT 1").get() as
      { id: string } | undefined;
    if (row) return row.id as LocalIdentityId;
    const id = randomUUID() as LocalIdentityId;
    this.db.prepare("INSERT INTO local_identity(id) VALUES (?)").run(id);
    return id;
  }

  listWorkspaces(identityId: LocalIdentityId) {
    return (
      this.db
        .prepare(
          `SELECT w.* FROM workspace w JOIN workspace_access a ON a.workspace_id=w.id
          WHERE a.identity_id=? ORDER BY w.created_at, w.id`,
        )
        .all(identityId) as Record<string, string>[]
    ).map(this.workspace);
  }

  findWorkspace(identityId: LocalIdentityId, id: WorkspaceId) {
    const row = this.db
      .prepare(
        `SELECT w.* FROM workspace w JOIN workspace_access a ON a.workspace_id=w.id
        WHERE a.identity_id=? AND w.id=?`,
      )
      .get(identityId, id) as Record<string, string> | undefined;
    return row && this.workspace(row);
  }

  confirmWorkspace(identityId: LocalIdentityId, candidate: Workspace) {
    const existing = this.db
      .prepare("SELECT * FROM workspace WHERE canonical_path=?")
      .get(candidate.canonicalPath) as Record<string, string> | undefined;
    const workspace = existing ? this.workspace(existing) : candidate;
    if (!existing)
      this.db
        .prepare(
          `INSERT INTO workspace(id,canonical_path,name,created_at,updated_at) VALUES (?,?,?,?,?)`,
        )
        .run(
          workspace.id,
          workspace.canonicalPath,
          workspace.name,
          workspace.createdAt.toISOString(),
          workspace.updatedAt.toISOString(),
        );
    this.db
      .prepare("INSERT OR IGNORE INTO workspace_access(identity_id,workspace_id) VALUES (?,?)")
      .run(identityId, workspace.id);
    return workspace;
  }

  revokeWorkspace(identityId: LocalIdentityId, id: WorkspaceId) {
    return (
      this.db
        .prepare("DELETE FROM workspace_access WHERE identity_id=? AND workspace_id=?")
        .run(identityId, id).changes > 0
    );
  }

  sessionMetadata(workspaceId: WorkspaceId, id: SessionId) {
    const row = this.db
      .prepare("SELECT name, deleted FROM session_metadata WHERE workspace_id=? AND session_id=?")
      .get(workspaceId, id) as { name: string | null; deleted: number } | undefined;
    return { ...(row?.name ? { name: row.name } : {}), deleted: row?.deleted === 1 };
  }

  renameSession(workspaceId: WorkspaceId, id: SessionId, name: string) {
    this.db
      .prepare(
        `INSERT INTO session_metadata(workspace_id,session_id,name) VALUES (?,?,?)
        ON CONFLICT(workspace_id,session_id) DO UPDATE SET name=excluded.name`,
      )
      .run(workspaceId, id, name);
  }

  deleteSession(workspaceId: WorkspaceId, id: SessionId) {
    this.db
      .prepare(
        `INSERT INTO session_metadata(workspace_id,session_id,deleted) VALUES (?,?,1)
        ON CONFLICT(workspace_id,session_id) DO UPDATE SET deleted=1`,
      )
      .run(workspaceId, id);
  }

  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  private readonly workspace = (row: Record<string, string>): Workspace => ({
    id: row.id as WorkspaceId,
    canonicalPath: row.canonical_path!,
    name: row.name!,
    createdAt: new Date(row.created_at!),
    updatedAt: new Date(row.updated_at!),
  });
}
