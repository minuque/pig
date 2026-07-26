import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { Store } from "../db/store.js";
import { projectSession } from "./projector.js";

/** Discovers Pi-owned JSONL sessions and reconciles only authorized Workspace roots. */
export class SessionProjectionCoordinator {
  constructor(
    private readonly store: Store,
    private readonly agentDir: string,
  ) {}
  async reconcile(): Promise<void> {
    const workspaces = this.store.all<any>("SELECT * FROM workspaces WHERE active=1");
    for (const workspace of workspaces) {
      let sessions: Awaited<ReturnType<typeof SessionManager.list>>;
      try {
        sessions = await SessionManager.list(
          workspace.canonical_root,
          join(this.agentDir, "sessions"),
        );
      } catch {
        continue;
      }
      for (const info of sessions) {
        const existing = this.store.row<any>("SELECT * FROM sessions WHERE session_id=?", info.id);
        if (existing && existing.source_path !== info.path) {
          this.store.run(
            "UPDATE sessions SET availability='quarantined',updated_at=? WHERE session_id=?",
            this.store.now(),
            info.id,
          );
          continue;
        }
        if (!existing) {
          const now = this.store.now();
          this.store.run(
            "INSERT INTO sessions(session_id,workspace_id,source_path,name,revision,availability,active,created_at,updated_at,last_summary) VALUES(?,?,?,?,1,'healthy',1,?,?,NULL)",
            info.id,
            workspace.workspace_id,
            info.path,
            info.name ?? "New session",
            info.created.toISOString(),
            now,
          );
        } else if (existing.workspace_id !== workspace.workspace_id || existing.active !== 1) {
          continue;
        }
        await projectSession(this.store, info.id, info.path);
      }
    }
  }
}
