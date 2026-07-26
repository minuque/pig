# Define local authentication and Workspace authorization

Type: grilling
Status: resolved
Blocked by:

## Question

What exact one-time bootstrap handshake, cookie policy, Host/Origin checks, CSRF treatment, Workspace registration flow, canonical-path authorization, symlink policy, and remote-compatible authentication seam should protect the local Gateway?

## Answer

A single deep **Gateway Access** module is the mandatory seam in front of every API and SSE handler. It validates the request target and browser context, authenticates a credential into a Principal, applies CSRF policy, and authorizes the operation against active Workspace grants. Handlers receive an `AccessContext`; they never parse cookies, trust paths, or implement ad hoc ownership checks.

The first release has one installation-level **Local Principal**. Its opaque non-secret ID is generated once and persisted so command idempotency and audit identity survive Gateway restarts. Browser credentials remain process-scoped and are never used as the Principal ID.

### Local bind and request gates

Local mode binds only `127.0.0.1` on an OS-assigned random port and serves the SPA and API from exactly `http://127.0.0.1:<port>`. The CLI has no non-loopback `--host` escape hatch. Opening a remote listener requires a future explicit remote Authenticator and TLS policy; local-cookie mode must refuse to start on any other interface.

Every request, including static assets, bootstrap exchange, REST, and SSE, passes these gates in order:

1. reject malformed authority and any `Host` other than exact `127.0.0.1:<assigned-port>`; never trust `X-Forwarded-Host`, `Forwarded`, or proxy-derived scheme/address in local mode;
2. reject any present `Origin` other than the exact local origin, including `null`;
3. reject `Sec-Fetch-Site: cross-site` or `same-site`. Cookie-authenticated mutations and the bootstrap exchange require exact `Origin` and, when Fetch Metadata is present, `same-origin`; missing Origin is not a write-request fallback;
4. authenticate the process-scoped browser credential;
5. require the session-bound CSRF token on every state-changing method;
6. authorize the Principal, operation, and resource through stored Workspace grants.

Read-only GET endpoints have no side effects. Authenticated GET/SSE may accept a missing Origin from a non-browser client only after exact Host and credential validation; any present Origin or Fetch Metadata must still pass. Native same-origin EventSource uses the HttpOnly Cookie, never a query token, and is not CSRF-bearing because it is read-only.

Local mode does not install Hono CORS middleware, emit `Access-Control-Allow-Origin`, reflect Origin, or accept cross-origin preflight. Authentication and bootstrap responses use `Cache-Control: no-store`; the SPA ships no third-party script or asset that can observe the startup fragment, and its static security policy denies framing and unnecessary external connections.

### One-time browser bootstrap

At startup the CLI generates a 256-bit random bootstrap secret, stores only an in-memory digest bound to the current Gateway epoch/origin, and opens:

```text
http://127.0.0.1:<port>/#bootstrap=<base64url-secret>
```

The fragment is never sent in the initial HTTP request. SPA startup reads it before loading optional application state, immediately removes it with `history.replaceState`, then sends it in an `application/json` body to `POST /api/v1/gateway-auth/bootstrap`. The exchange requires the exact Host/Origin/browser-context gates above, never logs the body, and returns no secret.

The secret expires after two minutes and is atomically consumed on the first successful exchange. Concurrent replay, a second exchange, wrong Gateway epoch/origin, expiry, or mismatch fails generically. After expiry or a failed/lost exchange, the CLI must generate and open a new fragment URL; one secret never issues multiple credentials.

A successful exchange rotates the one browser session allowed for that Gateway instance, invalidating any previous credential and CSRF token. Multiple tabs in one browser profile share that Cookie; a new browser bootstrap revokes the old browser profile.

### Cookie and CSRF policy

The local browser credential is an opaque 256-bit random session ID whose digest and associated CSRF secret live only in Gateway memory. The response sets one host-only Cookie with:

```text
HttpOnly; SameSite=Strict; Path=/api
```

It sets no `Domain`, `Max-Age`, or `Expires`. Gateway restart changes the epoch and loses the in-memory credential, so restored browser session Cookies are still invalid. Because the selected origin is plain HTTP on `127.0.0.1`, v1 does not claim portable `Secure` or `__Host-` Cookie behavior: Secure Context treatment of loopback is not the same as cross-browser Secure-Cookie acceptance. A future HTTPS remote adapter must use a separate Secure-cookie or bearer policy.

After exchange, authenticated `GET /api/v1/bootstrap` returns the current session-bound CSRF token along with the normal bounded bootstrap data. All tabs authenticated by that browser session receive the same token until credential rotation. The token is held only in SPA memory and sent on every POST/PATCH in a dedicated header. It never appears in a URL, Cookie, durable browser storage, log, Problem detail, or SSE event. Exact Origin, SameSite, Fetch Metadata, JSON content type, and CSRF validation are cumulative defenses; CORS is not treated as CSRF protection.

Cookie deletion/rotation uses the same name and `Path=/api`. Logout is not a separate first-release product workflow: closing/restarting Gateway invalidates the credential, while a new bootstrap atomically rotates it.

### Workspace registration

The CLI startup cwd is only a proposal, never an implicit grant. After authentication the SPA pre-fills that absolute path and asks the user to confirm. Registration uses a two-step flow so the user sees what is actually authorized:

1. `POST /api/v1/workspace-registration-previews` accepts an absolute existing-directory path and returns a short-lived, Principal-bound preview containing an opaque preview ID, display path, resolved canonical path, and safe warnings;
2. `POST /api/v1/workspaces` accepts the preview ID and `commandId`. The Gateway re-resolves and re-stats the path; if identity changed, the preview expires and confirmation must be repeated. Only then are the Workspace and Principal grant committed.

The same preview-confirm flow registers later Workspaces. Relative paths and implicit shell expansion such as `~` are rejected. Duplicate canonical roots return the existing Workspace idempotently. Nested Workspace roots are allowed; the most-specific active root owns an auto-discovered Session as decided by **Define Session projection and reconciliation**.

SQLite stores Workspace ID/revision, user-facing path, canonical root, available filesystem identity, Local Principal grant, and lifecycle state. Authenticated Workspace detail may return its paths; logs, events, unauthenticated responses, and Problem details do not.

### Canonical path and symlink rules

Registration resolves the submitted directory with native realpath semantics and stores the result as the canonical authorization root. A symlink may be submitted as the Workspace root, but its target—not the lexical alias—is the grant. On every Session create/resume, source discovery, and Pi Runtime creation, the Gateway resolves the candidate cwd again and performs component-aware containment against the canonical root; string-prefix checks are forbidden.

A Session cwd reached through a symlink is allowed only when its resolved target remains under the root. An escaping link, different volume/root, missing directory, ambiguous canonicalization, or changed root filesystem identity is rejected or marks the Workspace unavailable until it is explicitly re-registered. Authorization checks use the Workspace's stable ID and active grant after containment; request bodies and Pi headers never grant themselves access.

These checks prevent Gateway resource confusion and unauthorized Session association. They are **not an Agent sandbox**. Pi tools, `bash`, extensions, and child processes still run with the OS permissions of the user who launched the CLI and can access paths outside the Workspace. The first release deliberately follows Pi's trust model; sensitive use should run under a dedicated OS account, container, or other external sandbox. The product must not describe Workspace authorization as filesystem confinement.

### Unregister and revocation

Workspace unregister validates `expectedRevision` and `commandId`, closes admission through the Workspace/Session coordinators, and rejects while any Session has a nonterminal Run; the user must cancel those Runs explicitly. Once clear, it atomically revokes the grant, disposes resident runtimes, removes Workspace-owned projections, and emits removal events.

Unregister never moves, rewrites, or deletes Pi Session JSONL. Sources remain in place but disappear from every list, search, snapshot, and event because no active grant authorizes them. Re-registering the root can discover them again. Nested Workspace grants are independent; revoking a parent does not revoke a separately registered child.

### Remote-compatible seam

The internal Gateway Access interface returns only an `AccessContext` with Principal identity and verified request properties or a typed denial. Its local adapter owns exact-loopback authority, browser Cookie, bootstrap, Origin/Fetch Metadata, and CSRF behavior. The Workspace authorizer consumes Principal and resource identity and has no dependency on Cookie, Hono, CORS, or loopback details.

A future remote adapter may authenticate a bearer credential, mTLS identity, or HTTPS session into the same Principal shape and reuse the same Workspace authorizer. It must explicitly configure TLS, trusted proxy handling, allowed origins/CORS, credential lifecycle, and whether CSRF applies. Missing local headers never silently select remote mode, and local bootstrap secrets never become remote API keys.

### Contract additions and errors

This decision adds `GatewayAuthClient.exchangeLocalBootstrap()`, `WorkspaceRegistrationPreview`, `POST /api/v1/gateway-auth/bootstrap`, and `POST /api/v1/workspace-registration-previews` to the v1 registry. `Bootstrap` includes the authenticated Principal summary, in-memory CSRF token, and optional startup Workspace path proposal. Initial additional Problems include `auth.bootstrap_invalid`, `auth.csrf_invalid`, `workspace.path_invalid`, `workspace.path_changed`, `workspace.registration_preview_invalid`, and `workspace.in_use`; none reveal secrets or raw rejected paths.

Research asset: [Local Agent Gateway authentication and browser security facts](../research/local-gateway-auth-security.md).
