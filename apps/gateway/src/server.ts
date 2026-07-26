import { randomUUID } from "node:crypto";
import { access as accessFile, readFile, rename, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { createServer } from "node:http";
import { join } from "node:path";
import { getAgentDir, SessionManager } from "@earendil-works/pi-coding-agent";
import {
  BootstrapExchangeSchema,
  CancelRunSchema,
  CommandOnlySchema,
  CreateAuthFlowSchema,
  CreateRunSchema,
  CreateSessionSchema,
  CreateWorkspacePreviewSchema,
  CreateWorkspaceSchema,
  ProviderIdSchema,
  RespondAuthFlowSchema,
  RevisionCommandSchema,
  SessionListQuerySchema,
  SetApiKeySchema,
  SteerRunSchema,
  UpdateSessionSchema,
  UpdateWorkspaceSchema,
} from "@no-pi-no-gang/contracts";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { z } from "zod";
import { AccessError, GatewayAccess } from "./access/access.js";
import {
  type CapabilityAdapter,
  CapabilityCoordinator,
  PiCapabilityAdapter,
} from "./capabilities.js";
import { recordCommand, replayCommand, safeDigest } from "./commands/ledger.js";
import type { Store } from "./db/store.js";
import { Health } from "./diagnostics/health.js";
import { problem } from "./problem.js";
import { SessionProjectionCoordinator } from "./projection/coordinator.js";
import { RuntimeCoordinator } from "./runtime/coordinator.js";
import { EventHub, type Event as GatewayEvent } from "./stream/hub.js";
import type { DataRoots, GatewayHandle } from "./types.js";

export async function createHttpGateway(
  store: Store,
  _roots: DataRoots,
  proposedWorkspacePath?: string,
  publicDir = join(process.cwd(), "public"),
  options: {
    capabilities?: CapabilityAdapter;
    server?: Server;
    health?: Health;
  } = {},
): Promise<GatewayHandle> {
  const health = options.health ?? new Health();
  const hub = new EventHub();
  const access = new GatewayAccess(store, `http://127.0.0.1:0`, proposedWorkspacePath);
  const runtime = new RuntimeCoordinator(store, hub, getAgentDir());
  const capabilities = new CapabilityCoordinator(
    store,
    options.capabilities ? Promise.resolve(options.capabilities) : PiCapabilityAdapter.create(),
  );
  const app = new Hono();
  let serverPort = 0;
  const fail = (c: any, e: unknown) => {
    const known = new Set([
      "request.invalid_json",
      "request.validation_failed",
      "auth.bootstrap_invalid",
      "auth.unauthenticated",
      "auth.csrf_invalid",
      "auth.forbidden",
      "protocol.client_too_old",
      "workspace.not_found",
      "workspace.path_invalid",
      "workspace.registration_preview_invalid",
      "workspace.path_changed",
      "workspace.revision_conflict",
      "workspace.in_use",
      "session.not_found",
      "session.revision_conflict",
      "session.unavailable",
      "run.not_found",
      "run.invalid_state",
      "run.queue_full",
      "run.process_capacity",
      "command.admission_closed",
      "command.idempotency_conflict",
      "model.not_found",
      "model.unavailable",
      "model.thinking_unsupported",
      "provider_auth.required",
      "auth_flow.not_found",
      "auth_flow.invalid_state",
      "auth_flow.expired",
      "stream.cursor_invalid",
      "stream.replay_unavailable",
      "server.unavailable",
      "server.internal",
    ]);
    const candidate =
      e instanceof AccessError
        ? e.code
        : typeof e === "string"
          ? e
          : e instanceof Error
            ? e.message
            : undefined;
    const code = candidate && known.has(candidate) ? candidate : "server.internal";
    const statuses: Record<string, number> = {
      "request.invalid_json": 400,
      "request.validation_failed": 400,
      "auth.bootstrap_invalid": 401,
      "auth.unauthenticated": 401,
      "auth.csrf_invalid": 403,
      "auth.forbidden": 403,
      "workspace.not_found": 404,
      "workspace.path_invalid": 400,
      "workspace.registration_preview_invalid": 409,
      "workspace.path_changed": 409,
      "workspace.in_use": 409,
      "workspace.revision_conflict": 409,
      "session.not_found": 404,
      "session.revision_conflict": 409,
      "session.unavailable": 409,
      "run.not_found": 404,
      "run.invalid_state": 409,
      "run.queue_full": 409,
      "run.process_capacity": 429,
      "command.admission_closed": 409,
      "command.idempotency_conflict": 409,
      "model.not_found": 404,
      "model.unavailable": 409,
      "model.thinking_unsupported": 409,
      "provider_auth.required": 409,
      "auth_flow.not_found": 404,
      "auth_flow.invalid_state": 409,
      "auth_flow.expired": 410,
      "stream.cursor_invalid": 400,
      "stream.replay_unavailable": 409,
      "server.unavailable": 503,
    };
    const status = statuses[code] ?? 500;
    return c.json(problem(code, status), status);
  };
  app.use("*", async (c, next) => {
    try {
      if (c.req.method === "OPTIONS") return c.notFound();
      access.security(c, c.req.method !== "GET" && c.req.method !== "HEAD");
      await next();
    } catch (error) {
      return fail(c, error);
    }
  });
  app.onError((error, c) => fail(c, error));
  const parse = async (c: any, schema: z.ZodType) => {
    try {
      return schema.parse(await c.req.json());
    } catch {
      return fail(c, "request.validation_failed");
    }
  };
  app.get("/api/v1/health/live", (c) => c.json({ status: "live" }));
  app.get("/api/v1/health/ready", (c) =>
    c.json(
      health.get() === "ready" ? { status: "ready" } : { status: health.get() },
      health.get() === "ready" ? 200 : 503,
    ),
  );
  app.post("/api/v1/gateway-auth/bootstrap", async (c) => {
    try {
      access.security(c, true);
      const body = await parse(c, BootstrapExchangeSchema);
      if (!(body as any).secret) return body;
      const csrf = access.exchange((body as any).secret);
      return c.json(
        { csrfToken: csrf },
        {
          headers: {
            "set-cookie": access.cookie(),
            "cache-control": "no-store",
          },
        },
      );
    } catch (e) {
      return fail(c, e);
    }
  });
  const auth = (c: any, mutation = false) => access.auth(c, mutation);
  app.get("/api/v1/bootstrap", async (c) => {
    try {
      const a = auth(c);
      // Capture before any async/resource reads: events after this exact boundary
      // are replayed by the client from capturedEventCursor.
      const capturedEventCursor = hub.cursor();
      return c.json({
        gatewayBuildId: "0.1.0",
        principal: { principalId: a.principalId, displayName: "Local user" },
        contractRevision: 1,
        minClientRevision: 1,
        csrfToken: a.csrfToken,
        capabilities: {
          maxPageSize: 100,
          defaultPageSize: 25,
          maxQueuedRunsPerSession: 32,
          maxActiveRuns: 4,
          features: { sse: true, pi: true, authFlow: true },
        },
        models: await capabilities.models(),
        providerAuth: await capabilities.providerAuth(),
        nonterminalRuns: store
          .all<any>(
            "SELECT r.* FROM runs r JOIN sessions s ON s.session_id=r.session_id JOIN workspaces w ON w.workspace_id=s.workspace_id JOIN workspace_grants g ON g.workspace_id=w.workspace_id AND g.principal_id=? AND g.active=1 WHERE r.state NOT IN ('completed','failed','cancelled','interrupted') AND s.active=1 AND w.active=1",
            a.principalId,
          )
          .map((r) => runtime.summary(r)),
        capturedEventCursor,
        ...(proposedWorkspacePath ? { proposedWorkspacePath } : {}),
      });
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/workspace-registration-previews", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, CreateWorkspacePreviewSchema);
      if (!b || b instanceof Response) return b;
      const root = await access.canonical((b as any).candidatePath);
      const id = randomUUID().replaceAll("-", "_");
      store.run(
        "INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)",
        `preview:${id}`,
        JSON.stringify({
          principalId: a.principalId,
          root,
          expiresAt: Date.now() + 120000,
        }),
      );
      return c.json(
        {
          receipt: {
            commandId: (b as any).commandId,
            disposition: "accepted",
            acceptedAt: new Date().toISOString(),
          },
          result: {
            previewId: id,
            canonicalRoot: root,
            expiresAt: new Date(Date.now() + 120000).toISOString(),
            grantNotice: "Gateway access only; not a filesystem sandbox",
          },
        },
        201,
      );
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/workspaces", (c) => {
    try {
      const a = auth(c);
      return c.json({
        items: store
          .all<any>(
            "SELECT w.workspace_id as workspaceId,w.name,w.revision,w.updated_at as updatedAt FROM workspaces w JOIN workspace_grants g ON g.workspace_id=w.workspace_id AND g.principal_id=? AND g.active=1 WHERE w.active=1 ORDER BY w.updated_at DESC LIMIT 100",
            a.principalId,
          )
          .map((r) => r),
        nextCursor: null,
      });
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/workspaces", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, CreateWorkspaceSchema);
      if (!b || b instanceof Response) return b;
      const p = store.row<any>(
        "SELECT value FROM metadata WHERE key=?",
        `preview:${(b as any).previewId}`,
      );
      if (!p) throw new Error("workspace.registration_preview_invalid");
      const v = JSON.parse(String(p.value));
      if (v.principalId !== a.principalId || v.expiresAt < Date.now())
        throw new Error("workspace.registration_preview_invalid");
      const root = await access.canonical(v.root);
      if (root !== v.root) throw new Error("workspace.path_changed");
      const existing = store.row<any>(
        "SELECT * FROM workspaces WHERE principal_id=? AND canonical_root=? AND active=1",
        a.principalId,
        root,
      );
      if (existing)
        return c.json(
          {
            receipt: {
              commandId: (b as any).commandId,
              disposition: "replayed",
              acceptedAt: new Date().toISOString(),
            },
            result: {
              workspaceId: existing.workspace_id,
              name: existing.name,
              revision: existing.revision,
              updatedAt: existing.updated_at,
              canonicalRoot: root,
              grantNotice: "Gateway access only; not a filesystem sandbox",
            },
          },
          201,
        );
      const id = randomUUID().replaceAll("-", "_"),
        now = new Date().toISOString();
      store.transaction(() => {
        store.run(
          "INSERT INTO workspaces(workspace_id,principal_id,name,canonical_root,revision,active,updated_at) VALUES(?,?,?,?,1,1,?)",
          id,
          a.principalId,
          (b as any).name,
          root,
          now,
        );
        store.run(
          "INSERT INTO workspace_grants(principal_id,workspace_id,active,created_at,updated_at) VALUES(?,?,1,?,?)",
          a.principalId,
          id,
          now,
          now,
        );
      });
      const detail = {
        workspaceId: id,
        name: (b as any).name,
        revision: 1,
        updatedAt: now,
        canonicalRoot: root,
        grantNotice: "Gateway access only; not a filesystem sandbox",
      };
      hub.publish({
        type: "workspace.changed",
        workspaceId: id,
        payload: detail,
      });
      return c.json(
        {
          receipt: {
            commandId: (b as any).commandId,
            disposition: "applied",
            acceptedAt: now,
          },
          result: detail,
        },
        201,
      );
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/workspaces/:workspaceId", (c) => {
    try {
      const a = auth(c);
      const w = access.authorizeWorkspace(a.principalId, c.req.param("workspaceId"));
      return c.json({
        workspaceId: w.workspace_id,
        name: w.name,
        revision: w.revision,
        updatedAt: w.updated_at,
        canonicalRoot: w.canonical_root,
        grantNotice: "Gateway access only; not a filesystem sandbox",
      });
    } catch (e) {
      return fail(c, e);
    }
  });
  app.patch("/api/v1/workspaces/:workspaceId", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, UpdateWorkspaceSchema);
      if (!b || b instanceof Response) return b;
      const w = await access.authorizeWorkspace(a.principalId, c.req.param("workspaceId"));
      const payload = {
        operation: "updateWorkspace",
        workspaceId: w.workspace_id,
        body: b,
      };
      const replay = replayCommand<any>(store, a.principalId, b.commandId, payload);
      if (replay) return c.json(replay);
      if (w.revision !== (b as any).expectedRevision)
        throw new Error("workspace.revision_conflict");
      store.run(
        "UPDATE workspaces SET name=?,revision=revision+1,updated_at=? WHERE workspace_id=?",
        (b as any).name,
        new Date().toISOString(),
        w.workspace_id,
      );
      const updateResult = {
        receipt: {
          commandId: (b as any).commandId,
          disposition: "applied",
          acceptedAt: new Date().toISOString(),
        },
        result: {
          workspaceId: w.workspace_id,
          name: (b as any).name,
          revision: w.revision + 1,
          updatedAt: new Date().toISOString(),
          canonicalRoot: w.canonical_root,
          grantNotice: "Gateway access only; not a filesystem sandbox",
        },
      };
      recordCommand(store, a.principalId, b.commandId, payload, updateResult);
      return c.json(updateResult);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/workspaces/:workspaceId/commands/unregister", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, RevisionCommandSchema);
      if (!b || b instanceof Response) return b;
      const workspaceId = c.req.param("workspaceId");
      const payload = {
        operation: "unregisterWorkspace",
        workspaceId,
        body: b,
      };
      const replay = replayCommand<any>(store, a.principalId, b.commandId, payload);
      if (replay) return c.json(replay);
      const w = await access.authorizeWorkspace(a.principalId, workspaceId);
      if (w.revision !== b.expectedRevision) throw new Error("workspace.revision_conflict");
      const busy = store.row<any>(
        "SELECT 1 as x FROM runs r JOIN sessions s ON s.session_id=r.session_id WHERE s.workspace_id=? AND r.state NOT IN ('completed','failed','cancelled','interrupted') LIMIT 1",
        w.workspace_id,
      );
      if (busy) throw new Error("workspace.in_use");
      const now = new Date().toISOString();
      const result = {
        receipt: {
          commandId: b.commandId,
          disposition: "applied",
          acceptedAt: now,
        },
        result: {
          workspaceId: w.workspace_id,
          name: w.name,
          revision: w.revision + 1,
          updatedAt: now,
        },
      };
      store.transaction(() => {
        store.run(
          "UPDATE workspaces SET active=0,revision=revision+1,updated_at=? WHERE workspace_id=? AND revision=? AND active=1",
          now,
          w.workspace_id,
          b.expectedRevision,
        );
        store.run(
          "UPDATE workspace_grants SET active=0,updated_at=? WHERE principal_id=? AND workspace_id=? AND active=1",
          now,
          a.principalId,
          w.workspace_id,
        );
        store.run(
          "UPDATE sessions SET active=0,availability='unavailable',revision=revision+1,updated_at=? WHERE workspace_id=?",
          now,
          w.workspace_id,
        );
        store.run(
          "DELETE FROM session_search WHERE session_id IN (SELECT session_id FROM sessions WHERE workspace_id=?)",
          w.workspace_id,
        );
        store.run(
          "DELETE FROM session_entries WHERE session_id IN (SELECT session_id FROM sessions WHERE workspace_id=?)",
          w.workspace_id,
        );
        recordCommand(store, a.principalId, b.commandId, payload, result);
      });
      hub.publish({
        type: "workspace.removed",
        workspaceId: w.workspace_id,
        payload: { revision: w.revision + 1 },
      });
      return c.json(result);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/workspaces/:workspaceId/sessions", (c) => {
    try {
      const a = auth(c);
      const w = awaitWorkspace(store, access, a.principalId, c.req.param("workspaceId"));
      const q = SessionListQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
      const limit = q.limit ?? 25;
      const cursor = q.cursor ? decodeCursor(q.cursor) : undefined;
      const rows = q.search
        ? store.all<any>(
            "SELECT s.session_id as sessionId,s.workspace_id as workspaceId,s.name,s.revision,s.availability,s.updated_at as updatedAt FROM sessions s JOIN session_search f ON f.session_id=s.session_id WHERE s.workspace_id=? AND s.active=1 AND f.text MATCH ? AND (? IS NULL OR s.updated_at < ? OR (s.updated_at = ? AND s.session_id < ?)) GROUP BY s.session_id ORDER BY s.updated_at DESC,s.session_id DESC LIMIT ?",
            w.workspace_id,
            toFtsQuery(q.search),
            cursor?.updatedAt ?? null,
            cursor?.updatedAt ?? null,
            cursor?.updatedAt ?? null,
            cursor?.sessionId ?? "",
            limit + 1,
          )
        : store.all<any>(
            "SELECT session_id as sessionId,workspace_id as workspaceId,name,revision,availability,updated_at as updatedAt FROM sessions WHERE workspace_id=? AND active=1 AND (? IS NULL OR updated_at < ? OR (updated_at = ? AND session_id < ?)) ORDER BY updated_at DESC,session_id DESC LIMIT ?",
            w.workspace_id,
            cursor?.updatedAt ?? null,
            cursor?.updatedAt ?? null,
            cursor?.updatedAt ?? null,
            cursor?.sessionId ?? "",
            limit + 1,
          );
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? encodeCursor(items.at(-1)) : null;
      return c.json({ items, nextCursor });
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/workspaces/:workspaceId/sessions", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, CreateSessionSchema);
      if (!b || b instanceof Response) return b;
      const w = awaitWorkspace(store, access, a.principalId, c.req.param("workspaceId"));
      const payload = {
        operation: "createSession",
        workspaceId: w.workspace_id,
        body: b,
      };
      const replay = replayCommand<any>(store, a.principalId, b.commandId, payload);
      if (replay) return c.json(replay, 201);
      const sm = SessionManager.create(w.canonical_root, join(getAgentDir(), "sessions"));
      sm.appendSessionInfo((b as any).name);
      const source = sm.getSessionFile();
      const header = sm.getHeader();
      if (!source || !header) throw new Error("server.internal");
      // Pi defers its first disk flush until an assistant message exists. The
      // workbench must make a newly created native Session reopenable before
      // the first Run, so persist the exact public Pi header and entries as JSONL.
      const nativeEntries = [header, ...sm.getEntries()];
      await writeFile(
        source,
        `${nativeEntries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      );
      const id = sm.getSessionId(),
        now = new Date().toISOString();
      store.run(
        "INSERT INTO sessions(session_id,workspace_id,source_path,name,revision,availability,created_at,updated_at) VALUES(?,?,?,?,1,?,?,?)",
        id,
        w.workspace_id,
        source,
        (b as any).name,
        "healthy",
        now,
        now,
      );
      const d = {
        sessionId: id,
        workspaceId: w.workspace_id,
        name: (b as any).name,
        revision: 1,
        availability: "healthy",
        updatedAt: now,
        createdAt: now,
      };
      const sessionResult = {
        receipt: {
          commandId: (b as any).commandId,
          disposition: "applied",
          acceptedAt: now,
        },
        result: d,
      };
      recordCommand(store, a.principalId, b.commandId, payload, sessionResult);
      return c.json(sessionResult, 201);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/sessions/:sessionId", (c) => {
    try {
      const a = auth(c);
      const s = awaitSession(store, access, a.principalId, c.req.param("sessionId"));
      return c.json(sessionDetail(s));
    } catch (e) {
      return fail(c, e);
    }
  });
  app.patch("/api/v1/sessions/:sessionId", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, UpdateSessionSchema);
      if (!b || b instanceof Response) return b;
      const s = awaitSession(store, access, a.principalId, c.req.param("sessionId"));
      const payload = {
        operation: "updateSession",
        sessionId: s.session_id,
        body: b,
      };
      const replay = replayCommand<any>(store, a.principalId, b.commandId, payload);
      if (replay) return c.json(replay);
      if (s.revision !== (b as any).expectedRevision || s.availability !== "healthy")
        throw new Error(
          s.availability !== "healthy" ? "session.unavailable" : "session.revision_conflict",
        );
      const sm = SessionManager.open(s.source_path);
      sm.appendSessionInfo((b as any).name);
      store.run(
        "UPDATE sessions SET name=?,revision=revision+1,updated_at=? WHERE session_id=?",
        (b as any).name,
        new Date().toISOString(),
        s.session_id,
      );
      const sessionUpdateResult = {
        receipt: {
          commandId: (b as any).commandId,
          disposition: "applied",
          acceptedAt: new Date().toISOString(),
        },
        result: {
          sessionId: s.session_id,
          workspaceId: s.workspace_id,
          name: (b as any).name,
          revision: s.revision + 1,
          availability: s.availability,
          updatedAt: new Date().toISOString(),
          createdAt: s.created_at,
        },
      };
      recordCommand(store, a.principalId, b.commandId, payload, sessionUpdateResult);
      return c.json(sessionUpdateResult);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/sessions/:sessionId/commands/delete", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, RevisionCommandSchema);
      if (!b || b instanceof Response) return b;
      const sessionId = c.req.param("sessionId");
      const payload = { operation: "deleteSession", sessionId, body: b };
      const replay = replayCommand<any>(store, a.principalId, b.commandId, payload);
      if (replay) return c.json(replay, 202);
      const s = awaitSession(store, access, a.principalId, sessionId);
      if (s.revision !== b.expectedRevision) throw new Error("session.revision_conflict");
      const priorDelete = store.row<any>(
        "SELECT * FROM session_delete_ops WHERE session_id=?",
        s.session_id,
      );
      if (
        priorDelete &&
        (priorDelete.command_id !== b.commandId ||
          !["prepared", "renaming"].includes(priorDelete.state))
      ) {
        throw new Error("session.unavailable");
      }
      const busy = store.row<any>(
        "SELECT 1 AS x FROM runs WHERE session_id=? AND state NOT IN ('completed','failed','cancelled','interrupted') LIMIT 1",
        s.session_id,
      );
      if (busy) throw new Error("run.invalid_state");
      const now = store.now();
      const freshResult = {
        receipt: {
          commandId: b.commandId,
          disposition: "applied",
          acceptedAt: now,
        },
        result: {
          sessionId: s.session_id,
          workspaceId: s.workspace_id,
          name: s.name,
          revision: s.revision + 1,
          availability: "unavailable",
          updatedAt: now,
        },
      };
      const priorManifest = priorDelete
        ? parseSessionDeleteManifest(priorDelete.manifest_json)
        : undefined;
      if (
        priorDelete &&
        (!priorManifest ||
          priorManifest.principalId !== a.principalId ||
          priorManifest.payloadHash !== safeDigest(payload))
      ) {
        throw new Error("command.idempotency_conflict");
      }
      const result = priorManifest?.result ?? freshResult;
      const manifest =
        priorManifest ??
        ({
          principalId: a.principalId,
          payloadHash: safeDigest(payload),
          payload,
          result,
        } satisfies SessionDeleteManifest);
      const deleteOp =
        priorDelete ??
        ({
          session_id: s.session_id,
          command_id: b.commandId,
          source_path: s.source_path,
          recycle_path: `${s.source_path}.recycle-${s.session_id}-${b.commandId}`,
        } satisfies SessionDeleteOperation);
      if (!priorDelete) {
        store.run(
          "INSERT INTO session_delete_ops(session_id,command_id,source_path,recycle_path,manifest_json,state,created_at,updated_at) VALUES(?,?,?,?,?,'prepared',?,?)",
          deleteOp.session_id,
          deleteOp.command_id,
          deleteOp.source_path,
          deleteOp.recycle_path,
          JSON.stringify(manifest),
          now,
          now,
        );
      }
      store.run(
        "UPDATE session_delete_ops SET state='renaming',updated_at=? WHERE session_id=?",
        store.now(),
        deleteOp.session_id,
      );
      const sourceExists = await fileExists(deleteOp.source_path);
      const recycleExists = await fileExists(deleteOp.recycle_path);
      if (sourceExists && recycleExists) {
        markSessionDeleteBlocked(store, deleteOp.session_id, "conflict", "quarantined");
        throw new Error("session.unavailable");
      }
      if (!sourceExists && !recycleExists) {
        markSessionDeleteBlocked(store, deleteOp.session_id, "missing", "unavailable");
        throw new Error("session.unavailable");
      }
      if (sourceExists) await rename(deleteOp.source_path, deleteOp.recycle_path);
      finalizeSessionDelete(store, deleteOp, manifest);
      hub.publish({
        type: "session.removed",
        workspaceId: s.workspace_id,
        sessionId: s.session_id,
        payload: { revision: s.revision + 1 },
      });
      return c.json(result, 202);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/sessions/:sessionId/transcript", (c) => {
    try {
      const a = auth(c);
      const s = awaitSession(store, access, a.principalId, c.req.param("sessionId"));
      return c.json({
        items: store
          .all<any>(
            "SELECT item_json FROM session_entries WHERE session_id=? ORDER BY source_order LIMIT 500",
            s.session_id,
          )
          .map((x) => JSON.parse(String(x.item_json))),
        nextCursor: null,
      });
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/sessions/:sessionId/snapshot", (c) => {
    try {
      const a = auth(c);
      // Capture before every resource read. Any event racing with the reads is
      // replayed after this exact snapshot boundary.
      const capturedEventCursor = hub.cursor();
      const s = awaitSession(store, access, a.principalId, c.req.param("sessionId"));
      return c.json({
        session: sessionDetail(s),
        activeRuns: store
          .all<any>(
            "SELECT * FROM runs WHERE session_id=? AND state IN ('starting','running','cancelling')",
            s.session_id,
          )
          .map((r) => runtime.summary(r)),
        queuedRuns: store
          .all<any>(
            "SELECT * FROM runs WHERE session_id=? AND state='queued' LIMIT 32",
            s.session_id,
          )
          .map((r) => runtime.summary(r)),
        transcriptTail: store
          .all<any>(
            "SELECT item_json FROM session_entries WHERE session_id=? ORDER BY source_order DESC LIMIT 500",
            s.session_id,
          )
          .reverse()
          .map((x) => JSON.parse(String(x.item_json))),
        partialOutputs: [],
        capturedEventCursor,
        durableEntryCursor: null,
        historyTruncated: false,
        previousTranscriptCursor: null,
      });
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/sessions/:sessionId/runs", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, CreateRunSchema);
      if (!b || b instanceof Response) return b;
      const s = awaitSession(store, access, a.principalId, c.req.param("sessionId"));
      if (s.availability !== "healthy") throw new Error("session.unavailable");
      let row = runtime.replayCreateRun(a.principalId, s.session_id, b);
      if (!row) {
        await capabilities.validateExecutionProfile(b.executionProfile);
        row = runtime.createRun(a.principalId, s.session_id, b);
      }
      return c.json(
        {
          receipt: {
            commandId: (b as any).commandId,
            disposition: "accepted",
            acceptedAt: new Date().toISOString(),
          },
          result: row,
        },
        202,
      );
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/runs/:runId", (c) => {
    try {
      const a = auth(c);
      const r = awaitRun(store, a.principalId, c.req.param("runId"));
      return c.json({
        ...runtime.summary(r),
        prompt: r.prompt,
        ...(r.failure_code ? { failureCode: r.failure_code } : {}),
      });
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/runs/:runId/commands/cancel", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, CancelRunSchema);
      if (!b || b instanceof Response) return b;
      const r = awaitRun(store, a.principalId, c.req.param("runId"));
      await runtime.cancel(r.run_id, a.principalId, (b as any).commandId);
      return c.json(
        {
          receipt: {
            commandId: (b as any).commandId,
            disposition: "accepted",
            acceptedAt: new Date().toISOString(),
          },
          result: runtime.summary(store.row<any>("SELECT * FROM runs WHERE run_id=?", r.run_id)),
        },
        202,
      );
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/runs/:runId/commands/steer", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, SteerRunSchema);
      if (!b || b instanceof Response) return b;
      const r = awaitRun(store, a.principalId, c.req.param("runId"));
      await runtime.steer(r.run_id, (b as any).instruction, a.principalId, (b as any).commandId);
      return c.json(
        {
          receipt: {
            commandId: (b as any).commandId,
            disposition: "accepted",
            acceptedAt: new Date().toISOString(),
          },
          result: runtime.summary(r),
        },
        202,
      );
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/models", async (c) => {
    try {
      auth(c);
      return c.json(await capabilities.models());
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/provider-auth", async (c) => {
    try {
      auth(c);
      return c.json(await capabilities.providerAuth());
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/provider-auth/:providerId/commands/set-api-key", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, SetApiKeySchema);
      if (!b || b instanceof Response) return b;
      const providerId = ProviderIdSchema.parse(c.req.param("providerId"));
      const payload = { operation: "setProviderApiKey", providerId, body: b };
      const replay = replayCommand<any>(store, a.principalId, b.commandId, payload);
      if (replay) return c.json(replay, 202);
      const status = await capabilities.setApiKey(a.principalId, providerId, b.apiKey);
      const result = {
        receipt: {
          commandId: b.commandId,
          disposition: "applied",
          acceptedAt: store.now(),
        },
        result: status,
      };
      store.transaction(() => recordCommand(store, a.principalId, b.commandId, payload, result));
      hub.publish({ type: "providerAuth.changed", payload: status });
      return c.json(result, 202);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/provider-auth/:providerId/commands/delete-credential", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, CommandOnlySchema);
      if (!b || b instanceof Response) return b;
      const providerId = ProviderIdSchema.parse(c.req.param("providerId"));
      const payload = {
        operation: "deleteProviderCredential",
        providerId,
        body: b,
      };
      const replay = replayCommand<any>(store, a.principalId, b.commandId, payload);
      if (replay) return c.json(replay, 202);
      const status = await capabilities.deleteCredential(a.principalId, providerId);
      const result = {
        receipt: {
          commandId: b.commandId,
          disposition: "applied",
          acceptedAt: store.now(),
        },
        result: status,
      };
      store.transaction(() => recordCommand(store, a.principalId, b.commandId, payload, result));
      hub.publish({ type: "providerAuth.changed", payload: status });
      return c.json(result, 202);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/provider-auth/:providerId/auth-flows", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, CreateAuthFlowSchema);
      if (!b || b instanceof Response) return b;
      const providerId = ProviderIdSchema.parse(c.req.param("providerId"));
      const payload = { operation: "createAuthFlow", providerId, body: b };
      const replay = replayCommand<any>(store, a.principalId, b.commandId, payload);
      if (replay) return c.json(replay, 202);
      const flow = await capabilities.create(a.principalId, providerId);
      const result = {
        receipt: {
          commandId: b.commandId,
          disposition: "accepted",
          acceptedAt: store.now(),
        },
        result: flow,
      };
      store.transaction(() => recordCommand(store, a.principalId, b.commandId, payload, result));
      hub.publish({ type: "authFlow.changed", payload: flow });
      return c.json(result, 202);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/auth-flows/:flowId", (c) => {
    try {
      const a = auth(c);
      return c.json(capabilities.get(a.principalId, c.req.param("flowId")));
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/auth-flows/:flowId/commands/respond", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, RespondAuthFlowSchema);
      if (!b || b instanceof Response) return b;
      const flow = capabilities.respond(
        a.principalId,
        c.req.param("flowId"),
        b.promptId,
        b.response,
      );
      const result = {
        receipt: {
          commandId: b.commandId,
          disposition: "accepted",
          acceptedAt: store.now(),
        },
        result: flow,
      };
      const payload = {
        operation: "respondAuthFlow",
        flowId: c.req.param("flowId"),
        promptId: b.promptId,
        commandId: b.commandId,
      };
      store.transaction(() => recordCommand(store, a.principalId, b.commandId, payload, result));
      hub.publish({ type: "authFlow.changed", payload: flow });
      return c.json(result, 202);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.post("/api/v1/auth-flows/:flowId/commands/cancel", async (c) => {
    try {
      const a = auth(c, true),
        b = await parse(c, CommandOnlySchema);
      if (!b || b instanceof Response) return b;
      const flow = capabilities.cancel(a.principalId, c.req.param("flowId"));
      const result = {
        receipt: {
          commandId: b.commandId,
          disposition: "accepted",
          acceptedAt: store.now(),
        },
        result: flow,
      };
      const payload = {
        operation: "cancelAuthFlow",
        flowId: c.req.param("flowId"),
        commandId: b.commandId,
      };
      store.transaction(() => recordCommand(store, a.principalId, b.commandId, payload, result));
      hub.publish({ type: "authFlow.changed", payload: flow });
      return c.json(result, 202);
    } catch (e) {
      return fail(c, e);
    }
  });
  app.get("/api/v1/events", (c) => {
    try {
      const a = auth(c);
      const after = c.req.query("after");
      const visibleWorkspaces = new Set(
        store
          .all<{ workspace_id: string }>(
            "SELECT w.workspace_id FROM workspaces w JOIN workspace_grants g ON g.workspace_id=w.workspace_id AND g.principal_id=? AND g.active=1 WHERE w.active=1",
            a.principalId,
          )
          .map((row) => row.workspace_id),
      );
      return streamSSE(c, async (stream) => {
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => {
          finish = resolve;
        });
        const writeVisibleEvent = async (event: GatewayEvent): Promise<void> => {
          if (event.workspaceId && event.type === "workspace.changed") {
            const authorized = store.row<{ workspace_id: string }>(
              "SELECT w.workspace_id FROM workspaces w JOIN workspace_grants g ON g.workspace_id=w.workspace_id AND g.principal_id=? AND g.active=1 WHERE w.workspace_id=? AND w.active=1",
              a.principalId,
              event.workspaceId,
            );
            if (authorized) visibleWorkspaces.add(event.workspaceId);
          }
          if (event.workspaceId && !visibleWorkspaces.has(event.workspaceId)) return;
          await stream.writeSSE({
            id: `${event.gatewayEpoch}:${event.gatewaySeq}`,
            data: JSON.stringify(event),
          });
          if (event.workspaceId && event.type === "workspace.removed") {
            visibleWorkspaces.delete(event.workspaceId);
          }
        };
        const prepared = hub.prepareSubscription(after, writeVisibleEvent, {
          onLag: async (latestCursor) => {
            await stream.writeSSE({
              data: JSON.stringify({
                type: "stream.reset",
                reason: "client_lagged",
                ...(after ? { requestedCursor: after } : {}),
                ...(hub.oldestCursor() ? { oldestCursor: hub.oldestCursor() } : {}),
                latestCursor,
              }),
            });
            stream.close();
            finish();
          },
        });
        if ("reason" in prepared) {
          await stream.writeSSE({
            data: JSON.stringify({
              type: "stream.reset",
              reason: prepared.reason,
              ...(after ? { requestedCursor: after } : {}),
              ...(hub.oldestCursor() ? { oldestCursor: hub.oldestCursor() } : {}),
              latestCursor: hub.cursor(),
            }),
          });
          stream.close();
          return;
        }
        for (const event of prepared.replay) {
          await writeVisibleEvent(event);
        }
        // ready is a post-replay control boundary. The subscriber remains
        // paused until it has been written, so writeSSE is never concurrent.
        await stream.writeSSE({
          data: JSON.stringify({
            type: "stream.ready",
            latestCursor: hub.cursor(),
          }),
        });
        prepared.start();
        c.req.raw.signal.addEventListener(
          "abort",
          () => {
            prepared.stop();
            finish();
          },
          { once: true },
        );
        await finished;
      });
    } catch (e) {
      return fail(c, e);
    }
  });
  app.all("*", async (c) => {
    try {
      const rel = c.req.path === "/" ? "index.html" : c.req.path.replace(/^\//, "");
      const file = join(publicDir, rel);
      const body = await readFile(file);
      const type = rel.endsWith(".js")
        ? "text/javascript"
        : rel.endsWith(".html")
          ? "text/html"
          : "application/octet-stream";
      return c.body(body as any, {
        headers: {
          "content-type": type,
          "cache-control": rel === "index.html" ? "no-store" : "public,max-age=31536000,immutable",
        },
      });
    } catch {
      return c.text("Not found", 404);
    }
  });
  const server = options.server ?? createServer();
  server.removeAllListeners("request");
  server.on("request", async (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (x) => chunks.push(x));
    req.on("end", async () => {
      try {
        const url = `http://127.0.0.1:${serverPort}${req.url ?? "/"}`;
        const init: RequestInit = {
          method: req.method ?? "GET",
          headers: req.headers as HeadersInit,
        };
        if (req.method !== "GET" && req.method !== "HEAD") init.body = Buffer.concat(chunks) as any;
        const response = await app.fetch(new Request(url, init));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const n = await reader.read();
            if (n.done) break;
            res.write(Buffer.from(n.value));
          }
        }
        res.end();
      } catch {
        res.statusCode = 500;
        res.end();
      }
    });
  });
  if (server.listening) {
    serverPort = (server.address() as any).port;
  } else {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => {
        serverPort = (server.address() as any).port;
        resolve();
      }),
    );
  }
  access.setOrigin(`http://127.0.0.1:${serverPort}`);
  health.set("reconciling");
  await recoverSessionDeletes(store);
  await new SessionProjectionCoordinator(store, getAgentDir()).reconcile();
  health.set("ready");
  return {
    origin: `http://127.0.0.1:${serverPort}`,
    port: serverPort,
    epoch: hub.epoch,
    bootstrapUrl: `http://127.0.0.1:${serverPort}/#bootstrap=${access.bootstrapSecret}`,
    server,
    db: store.db,
    close: async () => {
      health.set("shutting_down");
      const serverClosed = new Promise<void>((resolve) => server.close(() => resolve()));
      await runtime.close();
      server.closeAllConnections();
      await serverClosed;
      store.db.close();
    },
  };
}
type SessionDeleteOperation = {
  session_id: string;
  command_id: string;
  source_path: string;
  recycle_path: string;
};

type SessionDeleteManifest = {
  principalId: string;
  payloadHash: string;
  payload: unknown;
  result: unknown;
};

async function fileExists(path: string): Promise<boolean> {
  return accessFile(path)
    .then(() => true)
    .catch(() => false);
}

function parseSessionDeleteManifest(raw: unknown): SessionDeleteManifest | undefined {
  try {
    const value = JSON.parse(String(raw)) as Partial<SessionDeleteManifest>;
    if (
      typeof value.principalId !== "string" ||
      typeof value.payloadHash !== "string" ||
      value.payload === undefined ||
      value.result === undefined ||
      value.payloadHash !== safeDigest(value.payload)
    ) {
      return undefined;
    }
    return value as SessionDeleteManifest;
  } catch {
    return undefined;
  }
}

function markSessionDeleteBlocked(
  store: Store,
  sessionId: string,
  state: "conflict" | "missing",
  availability: "quarantined" | "unavailable",
): void {
  store.transaction(() => {
    store.run(
      "UPDATE session_delete_ops SET state=?,updated_at=? WHERE session_id=?",
      state,
      store.now(),
      sessionId,
    );
    store.run(
      "UPDATE sessions SET availability=?,revision=revision+1,updated_at=? WHERE session_id=?",
      availability,
      store.now(),
      sessionId,
    );
  });
}

function finalizeSessionDelete(
  store: Store,
  operation: SessionDeleteOperation,
  manifest?: SessionDeleteManifest,
): void {
  store.transaction(() => {
    store.run("DELETE FROM session_search WHERE session_id=?", operation.session_id);
    store.run("DELETE FROM session_entries WHERE session_id=?", operation.session_id);
    store.run(
      "UPDATE sessions SET active=0,availability='unavailable',revision=revision+1,updated_at=? WHERE session_id=?",
      store.now(),
      operation.session_id,
    );
    store.run(
      "INSERT OR REPLACE INTO tombstones(session_id,command_id,deleted_at) VALUES(?,?,?)",
      operation.session_id,
      operation.command_id,
      store.now(),
    );
    store.run(
      "UPDATE session_delete_ops SET state='committed',updated_at=? WHERE session_id=?",
      store.now(),
      operation.session_id,
    );
    if (manifest) {
      recordCommand(
        store,
        manifest.principalId,
        operation.command_id,
        manifest.payload,
        manifest.result,
      );
    }
  });
}

async function recoverSessionDeletes(store: Store): Promise<void> {
  const operations = store.all<SessionDeleteOperation & { manifest_json: string }>(
    "SELECT * FROM session_delete_ops WHERE state IN ('prepared','renaming')",
  );
  for (const operation of operations) {
    try {
      const sourceExists = await fileExists(operation.source_path);
      const recycleExists = await fileExists(operation.recycle_path);
      if (sourceExists && recycleExists) {
        markSessionDeleteBlocked(store, operation.session_id, "conflict", "quarantined");
        continue;
      }
      if (!sourceExists && !recycleExists) {
        markSessionDeleteBlocked(store, operation.session_id, "missing", "unavailable");
        continue;
      }
      if (sourceExists) await rename(operation.source_path, operation.recycle_path);
      finalizeSessionDelete(store, operation, parseSessionDeleteManifest(operation.manifest_json));
    } catch {
      store.run(
        "UPDATE session_delete_ops SET state='recovery_failed',updated_at=? WHERE session_id=?",
        store.now(),
        operation.session_id,
      );
    }
  }
}
function encodeCursor(row: any): string {
  return Buffer.from(
    JSON.stringify({ updatedAt: row.updatedAt, sessionId: row.sessionId }),
    "utf8",
  ).toString("base64url");
}
function decodeCursor(value: string): { updatedAt: string; sessionId: string } {
  try {
    const x = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof x.updatedAt !== "string" || typeof x.sessionId !== "string") throw new Error();
    return x;
  } catch {
    throw new Error("request.validation_failed");
  }
}
function toFtsQuery(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => `"${x.replaceAll('"', '""')}"`)
    .join(" AND ");
}
function sessionDetail(row: any) {
  return {
    sessionId: row.session_id,
    workspaceId: row.workspace_id,
    name: row.name,
    revision: row.revision,
    availability: row.availability,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    ...(row.last_summary ? { lastVerifiedSummary: row.last_summary } : {}),
  };
}
function awaitWorkspace(_store: Store, access: GatewayAccess, p: string, id: string) {
  return access.authorizeWorkspace(p, id);
}
function awaitSession(store: Store, _access: GatewayAccess, p: string, id: string): any {
  const s = store.row<any>(
    "SELECT s.* FROM sessions s JOIN workspaces w ON w.workspace_id=s.workspace_id JOIN workspace_grants g ON g.workspace_id=w.workspace_id AND g.principal_id=? AND g.active=1 WHERE s.session_id=? AND s.active=1 AND w.active=1",
    p,
    id,
  );
  if (!s) throw new Error("session.not_found");
  return s;
}
function awaitRun(store: Store, principalId: string, runId: string): any {
  const run = store.row<any>(
    "SELECT r.*,s.workspace_id FROM runs r JOIN sessions s ON s.session_id=r.session_id JOIN workspaces w ON w.workspace_id=s.workspace_id JOIN workspace_grants g ON g.workspace_id=w.workspace_id AND g.principal_id=? AND g.active=1 WHERE r.run_id=? AND s.active=1 AND w.active=1",
    principalId,
    runId,
  );
  if (!run) throw new Error("run.not_found");
  return run;
}
