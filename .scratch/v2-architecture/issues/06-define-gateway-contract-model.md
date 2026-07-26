# Define the Gateway contract model

Type: grilling
Status: resolved
Blocked by: 05

## Question

Which versioned resources, commands, snapshots, event envelopes, error taxonomy, compatibility rules, and typed-client interface should `packages/contracts` expose without leaking Pi, Hono, or Vue types?

## Answer

`packages/contracts` is the schema-first seam shared by Gateway adapters and clients. Its public surface contains only project-owned domain values, Zod 4 schemas, endpoint descriptors, errors, events, and a typed client interface. It imports no Pi, Hono, Vue, `fetch`, or `EventSource` types.

```ts
export const endpoints: EndpointRegistry

export interface GatewayClient {
  gatewayAuth: GatewayAuthClient
  bootstrap: BootstrapClient
  workspaces: WorkspaceClient
  sessions: SessionClient
  runs: RunClient
  models: ModelClient
  providerAuth: ProviderAuthClient
  authFlows: AuthFlowClient
  events: EventClient
}
```

The endpoint registry is the sole declaration of each operation's `operationId`, method, `/api/v1` path, path/query/body schemas, success status/schema, and possible Problem codes. Hono and HTTP client adapters consume it, but callers use explicit grouped methods such as `client.sessions.list()` and `client.runs.cancel()`. A public generic `invoke(endpoint, unknown)` is excluded. The registry describes wire facts only; handlers, middleware, authorization, retries, and business workflows remain outside it so it does not become a second routing framework.

### Versioned resources

The v1 public resources are:

- `Bootstrap` and `Capabilities`;
- `WorkspaceRegistrationPreview`;
- `WorkspaceSummary` and `WorkspaceDetail`;
- `SessionSummary` and `SessionDetail`;
- `TranscriptItem` and `SessionSnapshot`;
- `RunSummary`, `RunDetail`, and immutable `ExecutionProfile`;
- `Model` and `ProviderAuthStatus`;
- short-lived `AuthFlow`;
- `CommandReceipt`, `MutationResult<T>`, and `CursorPage<T>`;
- `ProblemDetails`, typed Gateway events, stream controls, and client connection state.

Wire IDs are opaque branded strings; callers cannot parse prefixes or construct relationships from an ID. Timestamps are UTC RFC 3339 strings. Every mutable resource carries a monotonically increasing `revision`. Summary and Detail schemas are distinct: lists and bootstrap use bounded summaries, while full pending Run input is available only from authorized Run detail or Session snapshot. Credentials never appear in any resource.

`TranscriptItem` is a project-owned union over the current Pi branch:

```text
message | toolCall | toolResult | compaction | modelChange | notice | unsupported
```

Every item has a stable public `entryId`. `unsupported` preserves only safe identifying metadata; Pi entry types and raw payloads are never exposed. Tree navigation, abandoned-branch traversal, attachments, and multimodal input remain out of scope.

### Endpoints and commands

All public endpoints use `/api/v1`:

```text
POST /api/v1/gateway-auth/bootstrap
GET  /api/v1/bootstrap
GET  /api/v1/events

POST /api/v1/workspace-registration-previews
GET  /api/v1/workspaces
POST /api/v1/workspaces
GET  /api/v1/workspaces/:workspaceId
PATCH /api/v1/workspaces/:workspaceId
POST /api/v1/workspaces/:workspaceId/commands/unregister

GET  /api/v1/workspaces/:workspaceId/sessions
POST /api/v1/workspaces/:workspaceId/sessions
GET  /api/v1/sessions/:sessionId
PATCH /api/v1/sessions/:sessionId
POST /api/v1/sessions/:sessionId/commands/delete
GET  /api/v1/sessions/:sessionId/transcript
GET  /api/v1/sessions/:sessionId/snapshot

POST /api/v1/sessions/:sessionId/runs
GET  /api/v1/runs/:runId
POST /api/v1/runs/:runId/commands/steer
POST /api/v1/runs/:runId/commands/cancel

GET  /api/v1/models
GET  /api/v1/provider-auth
POST /api/v1/provider-auth/:providerId/commands/set-api-key
POST /api/v1/provider-auth/:providerId/commands/delete-credential
POST /api/v1/provider-auth/:providerId/auth-flows
GET  /api/v1/auth-flows/:flowId
POST /api/v1/auth-flows/:flowId/commands/respond
POST /api/v1/auth-flows/:flowId/commands/cancel
```

Queries read resources. Behavior with state-machine preconditions uses explicit command endpoints; clients cannot PATCH Run or AuthFlow state. Retry creates a new Run through the normal create endpoint and supplies `retryOfRunId` rather than reopening a terminal Run.

Every mutation body contains a client-generated `commandId`. Resource update, delete, and unregister bodies also contain `expectedRevision`; a mismatch is a revision conflict rather than last-write-wins. HTTP DELETE with a body is avoided. Run create captures and persists an immutable `ExecutionProfile { modelId, thinkingLevel }` at admission. UI model changes after admission cannot alter a queued Run, and retry copies the original profile unless the caller explicitly overrides it.

All mutation success bodies use one envelope:

```ts
type MutationResult<T> = {
  receipt: {
    commandId: CommandId
    disposition: "applied" | "accepted" | "replayed"
    acceptedAt: Instant
  }
  result: T
}
```

Synchronous resource transactions return 200 or 201; asynchronous Run and AuthFlow commands return 202 after durable admission. Idempotency is scoped by `(principalId, commandId)`. The canonical payload's safe digest, original receipt, and result reference are retained permanently, including after target deletion; large prompt bodies and secrets are not. The same ID and payload returns the original result with `replayed`, while the same ID with a different payload is rejected.

All list endpoints use opaque keyset pagination:

```ts
type CursorPage<T> = { items: T[]; nextCursor: OpaqueCursor | null }
```

Callers may only return a cursor to its originating operation and filter set. Default and maximum page sizes are capabilities. Delivery may repeat resources as concurrent updates change ordering, so callers deduplicate by ID and revision.

### Minimum health probes

`GET /health/live` and `GET /health/ready` are fixed registry operations under `/api/v1`. They are unauthenticated only to support CLI startup checks and still pass exact loopback Host and Fetch Metadata validation with CORS disabled. Liveness returns only `200 { status: "live" }`. Readiness returns only `200 { status: "ready" }` or `503` with one bounded code: `starting`, `migrating`, `reconciling`, `shutting_down`, or `unavailable`; neither endpoint exposes versions, paths, dependency details, capabilities, or errors. Authenticated Bootstrap remains the detailed compatibility/capability handshake.

### Bootstrap and snapshots

`GET /bootstrap` is a bounded consistency handshake, not a database dump. It returns Gateway/build identity, authenticated-principal summary, `contractRevision`, `minClientRevision`, capabilities and limits, model/provider readiness, nonterminal Run summaries, and a captured event cursor. Workspace, Session, and Transcript collections are fetched separately.

The unauthenticated local bootstrap exchange is a distinct one-time credential operation. After exchange, authenticated Bootstrap also carries the process-scoped CSRF token and optional CLI startup Workspace path proposal. `WorkspaceRegistrationPreview` is short-lived and Principal-bound; Workspace creation revalidates it before committing a canonical root. Exact browser and path-security semantics are owned by **Define local authentication and Workspace authorization**.

A Session snapshot is also bounded. The server first captures event cursor `C`, then reads and returns:

- Session identity and revision;
- active and queued Run summaries;
- the latest durable Transcript tail and durable entry cursor;
- current partial assistant text/thinking and tool-progress state;
- `capturedEventCursor: C`;
- `historyTruncated` and the cursor needed to continue through Transcript pagination.

The client reconnects after `C`; replay can duplicate snapshot state but cannot leave a gap. A truncated history is completed through the Transcript endpoint rather than expanding the snapshot without bound.

### Model and provider authentication

Models and provider authentication are project-owned normalized resources, never Pi objects. Model IDs are opaque and their capability fields are public product semantics. API keys and OAuth answers are write-only inputs: responses, resources, events, errors, and command-history payloads never echo them.

Pi provider authentication can require API key, browser OAuth, device code, a prompt, or a selection. Multi-step login is represented by an `AuthFlow` resource with terminal and nonterminal states and one safe interaction union:

```text
openUrl | deviceCode | prompt | select
```

The client creates a flow, observes it by snapshot/SSE, and submits interaction responses or cancel commands. Sensitive prompt responses are write-only. OAuth tokens go only to Pi AuthStorage. Gateway restart changes unfinished flows to `interrupted`; no flow or secret response is replayed automatically.

### Realtime contract

All cursor-bearing business events use a discriminated, project-owned envelope:

```ts
type GatewayEventEnvelope<TType extends string, TPayload> = {
  schemaVersion: 1
  contractRevision: number
  gatewayEpoch: string
  gatewaySeq: number
  type: TType
  emittedAt: Instant
  workspaceId?: WorkspaceId
  sessionId?: SessionId
  runId?: RunId
  runSeq?: number
  commandId?: CommandId
  durableEntryId?: EntryId
  payload: TPayload
}
```

An event's schema requires the scope fields relevant to its type; they are not arbitrarily optional. Its SSE `id` is exactly `${gatewayEpoch}:${gatewaySeq}`. `gatewaySeq` orders the multiplexed stream; `runSeq` orders one Run. Timestamps are diagnostic only. Delivery is at-least-once, and clients deduplicate by Gateway cursor, resource ID/revision, and durable entry ID.

The v1 business taxonomy is:

```text
workspace.changed | workspace.removed
session.changed   | session.removed
run.changed
transcript.item.committed
run.output.delta
run.phase.changed
models.changed
providerAuth.changed
authFlow.changed
```

Resource changes contain a full bounded public summary or resource with revision. `transcript.item.committed` contains one normalized durable item. Only `run.output.delta` uses limited `append` operations for text/thinking and `replace` operations for tool progress; generic JSON Patch is excluded. Retry, compaction, and tool activity use `run.phase.changed` and do not add Run states.

`stream.ready` and `stream.reset` are separate control events without SSE `id`, `gatewaySeq`, or cursor advancement. `stream.ready` follows replay and identifies the latest live cursor. `stream.reset` carries requested/oldest/latest cursors and a reason such as `cursor_invalid`, `epoch_changed`, `replay_unavailable`, or `client_lagged`, after which the server closes the stream.

The transport-neutral client exposes:

```ts
type GatewayStreamItem =
  | { kind: "connection"; state: "connecting" | "reconnecting" | "live" }
  | { kind: "event"; event: GatewayEvent | StreamControlEvent }

interface EventClient {
  open(input: { after?: EventCursor }, options?: { signal?: AbortSignal }): AsyncIterable<GatewayStreamItem>
}
```

The adapter owns EventSource framing, `Last-Event-ID`, automatic transient reconnect, runtime decoding, and cleanup. `AbortSignal` closes the connection and ends iteration normally. Authentication, protocol, and known-event decode errors throw. A reset is yielded and then iteration ends so the caller can bootstrap again. Unknown future business events advance the stored cursor, retain only safe envelope metadata, discard their payload, and are otherwise ignored.

### Errors

Non-2xx REST responses use RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail`, and `instance`, extended by stable `code`, `requestId`, `retryable`, optional `retryAfterMs`, and code-specific `details`. `detail` contains no secret, raw canonical path, Pi exception, or stack. Clients branch only on status and code.

Codes use globally unique dotted namespaces. The initial taxonomy includes:

```text
request.invalid_json
request.validation_failed
auth.unauthenticated
auth.forbidden
auth.bootstrap_invalid
auth.csrf_invalid
protocol.client_too_old
workspace.not_found
workspace.revision_conflict
workspace.path_invalid
workspace.path_changed
workspace.registration_preview_invalid
workspace.in_use
session.not_found
session.revision_conflict
session.unavailable
run.not_found
run.invalid_state
run.queue_full
command.idempotency_conflict
command.admission_closed
model.not_found
model.unavailable
provider_auth.required
auth_flow.not_found
auth_flow.invalid_state
auth_flow.expired
stream.cursor_invalid
stream.replay_unavailable
server.unavailable
server.internal
```

Later decisions may add codes inside these namespaces without changing existing meanings. Each endpoint descriptor lists its possible codes. Client methods return decoded success values and throw `GatewayClientError` for HTTP Problems, network failure, response/event decode failure, protocol incompatibility, or caller abort; the error preserves its typed kind and Problem when present, which matches Vue Query's rejected-Promise model.

### Schema and compatibility rules

REST and SSE use URL major `/api/v1` and event `schemaVersion: 1`. Bootstrap supplies `contractRevision`, `minClientRevision`, and typed capabilities. Additive feature differences are handled through capabilities. The minimum revision is raised only when security or foundational semantics cannot be made safe for an older official client; it is not a normal feature-rollout mechanism.

Within v1, compatible changes are limited to new endpoints, optional response fields, capability keys, Problem codes, and ignorable event types. Removing or requiring a field, changing existing meaning/defaults, or adding to a closed enum such as `RunState` is breaking and requires `/api/v2`. Official compatibility tests cover current/current, previous-client/current-Gateway, and current-client/previous-Gateway combinations.

Request object schemas are strict and reject unknown input. Server response encoding projects implementation values through the public schema and strips unknown fields so internal Pi or secret fields cannot leak. Client response decoders accept additive unknown fields but discard them, retaining only known public fields. Open event/capability sets have safe unknown handling; a decoder encountering an unknown value in a closed state set raises a protocol decode error and triggers snapshot recovery rather than guessing.

Research support: [Gateway contract versioning and compatibility](../research/gateway-contract-versioning.md).
