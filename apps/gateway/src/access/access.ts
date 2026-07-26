import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import type { Context, Next } from "hono";
import type { Store } from "../db/store.js";

export type AccessContext = {
  principalId: string;
  csrfToken?: string;
  workspaceId?: string;
};

export class AccessError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 401,
  ) {
    super(code);
  }
}

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();
const equalDigest = (left: Buffer, value: string): boolean => timingSafeEqual(left, digest(value));

export class GatewayAccess {
  readonly epoch = randomUUID();
  readonly bootstrapSecret: string;
  readonly proposedWorkspacePath: string | undefined;
  readonly principalId: string;
  private readonly secretDigest: Buffer;
  private readonly expiresAt: number;
  private used = false;
  private browser?: {
    sessionDigest: Buffer;
    csrf: string;
    principalId: string;
  };

  constructor(
    private readonly store: Store,
    private origin: string,
    proposed?: string,
    private readonly clock: () => number = Date.now,
  ) {
    const row = store.row<{ principal_id: string }>("SELECT principal_id FROM principals LIMIT 1");
    this.principalId = row?.principal_id ?? randomUUID();
    if (!row)
      store.run(
        "INSERT INTO principals(principal_id,display_name,created_at) VALUES(?,?,?)",
        this.principalId,
        "Local user",
        new Date(this.clock()).toISOString(),
      );
    const secret = randomBytes(32).toString("base64url");
    this.bootstrapSecret = secret;
    this.secretDigest = digest(secret);
    this.expiresAt = this.clock() + 120_000;
    this.proposedWorkspacePath = proposed;
  }

  security(c: Context, mutation = false): void {
    const expected = new URL(this.origin);
    if (c.req.header("host") !== expected.host) throw new AccessError("auth.forbidden", 403);
    const origin = c.req.header("origin");
    if (origin && origin !== this.origin) throw new AccessError("auth.forbidden", 403);
    const fetchSite = c.req.header("sec-fetch-site");
    if (fetchSite === "cross-site" || fetchSite === "same-site")
      throw new AccessError("auth.forbidden", 403);
    if (
      mutation &&
      (!origin ||
        origin !== this.origin ||
        (fetchSite !== undefined && fetchSite !== "same-origin"))
    )
      throw new AccessError("auth.forbidden", 403);
  }

  exchange(secret: string): string {
    if (this.used || this.clock() > this.expiresAt || !equalDigest(this.secretDigest, secret))
      throw new AccessError("auth.bootstrap_invalid");
    this.used = true;
    const session = randomBytes(32).toString("base64url");
    const csrf = randomBytes(32).toString("base64url");
    this.browser = {
      sessionDigest: digest(session),
      csrf,
      principalId: this.principalId,
    };
    this.pendingCookie = session;
    return csrf;
  }

  private pendingCookie: string | undefined;

  auth(c: Context, mutation = false): AccessContext {
    this.security(c, mutation);
    const raw = c.req.header("cookie")?.match(/(?:^|;\s*)npng_session=([^;]+)/)?.[1];
    if (!raw || !this.browser || !equalDigest(this.browser.sessionDigest, raw))
      throw new AccessError("auth.unauthenticated");
    if (mutation && c.req.header("x-csrf-token") !== this.browser.csrf)
      throw new AccessError("auth.csrf_invalid", 403);
    return {
      principalId: this.browser.principalId,
      csrfToken: this.browser.csrf,
    };
  }

  setOrigin(origin: string): void {
    this.origin = origin;
  }

  cookie(): string {
    if (!this.pendingCookie) throw new Error("auth_unavailable");
    const value = this.pendingCookie;
    this.pendingCookie = undefined;
    return `npng_session=${value}; HttpOnly; SameSite=Strict; Path=/api`;
  }

  async canonical(candidate: string): Promise<string> {
    if (!isAbsolute(candidate)) throw new AccessError("workspace.path_invalid", 400);
    try {
      return await realpath(candidate);
    } catch {
      throw new AccessError("workspace.path_invalid", 400);
    }
  }

  async contains(root: string, target: string): Promise<boolean> {
    const [canonicalRoot, canonicalTarget] = await Promise.all([
      this.canonical(root),
      this.canonical(target),
    ]);
    const value = relative(canonicalRoot, canonicalTarget);
    return value === "" || (!value.startsWith(`..${sep}`) && value !== ".." && !isAbsolute(value));
  }

  authorizeWorkspace(
    principalId: string,
    id: string,
  ): {
    workspace_id: string;
    canonical_root: string;
    name: string;
    revision: number;
  } {
    const row = this.store.row<{
      workspace_id: string;
      canonical_root: string;
      name: string;
      revision: number;
    }>(
      "SELECT w.workspace_id,w.canonical_root,w.name,w.revision FROM workspaces w JOIN workspace_grants g ON g.workspace_id=w.workspace_id AND g.principal_id=? AND g.active=1 WHERE w.workspace_id=? AND w.active=1",
      principalId,
      id,
    );
    if (!row) throw new AccessError("workspace.not_found", 404);
    return row;
  }
}

export async function accessMiddleware(access: GatewayAccess, c: Context, next: Next) {
  try {
    access.auth(c, c.req.method !== "GET");
    await next();
  } catch (error) {
    if (error instanceof AccessError)
      return c.json(
        {
          type: "about:blank",
          title: error.code,
          status: error.status,
          detail: error.code,
          instance: c.req.path,
          code: error.code,
          requestId: randomUUID(),
          retryable: error.code === "server.unavailable",
        },
        error.status as never,
      );
    throw error;
  }
}
