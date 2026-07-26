# Define diagnostics and operational visibility

Type: grilling
Status: resolved
Blocked by: 05, 08, 13

## Question

Which structured logs, redaction rules, health/capability endpoints, Run diagnostics, SSE lag/replay metrics, crash markers, support bundle contents, and user-visible recovery states are required to operate the local Gateway safely without exposing prompts or credentials?

## Answer

The first release provides only a **Minimum Safe Diagnostic Surface**: bounded allow-listed operational logs, request correlation, minimal liveness/readiness, a crash marker, and actionable user recovery states. It explicitly does not ship a diagnostics dashboard, support bundle, metrics exporter, distributed tracing, raw Node report, or durable Run phase timeline.

This is intentionally more operational than Pi's hidden `/debug` command. Pi writes a content-rich `pi-debug.log` only on demand and may include recent LLM messages; that model cannot be reused because Gateway diagnostics must never persist prompts or tool content.

### Typed allow-list logging

Gateway modules emit a closed union of project-owned `SafeDiagnosticEvent` values through one sink conceptually shaped as:

```ts
interface DiagnosticSink {
  emit(event: SafeDiagnosticEvent): void
  flush(): Promise<void>
}
```

The interface does not accept arbitrary objects, printf arguments, request objects, Pi events, or `Error` instances. Each event kind defines its own bounded fields. The sink sanitizes CR/LF/control characters and applies a second defensive secret/path deny-list before encoding one JSON object per line.

Every record may contain only the relevant subset of: timestamp, severity, event code, build/contract revision, Gateway epoch, component, request ID, command ID, opaque Workspace/Session/Run/AuthFlow IDs, route template, HTTP status class, duration, bounded counts, resource revision, safe Problem code, state transition, retry/reset category, and a sanitized error fingerprint. Identifiers are correlation handles, never replacements for credentials or browser session IDs.

The following are forbidden in every level and sink:

- prompt, assistant text, thinking, Transcript content, tool arguments/results/output, pending command content, or Pi message objects;
- request/response bodies, cookies, authorization/CSRF/bootstrap values, API keys, OAuth answers/tokens, or arbitrary headers/query strings;
- raw Workspace/Session paths, cwd, filenames supplied by tools, environment variables, command lines, network interfaces, SQLite rows, or Pi JSONL;
- unknown exception messages/stacks, serialized Error causes, raw provider responses, or `pi-debug.log`.

Known internal failures map first to a stable code plus a sanitized fingerprint based on owned error class and package-relative frames. Unknown errors log only category/fingerprint; their free-form message never passes through. Source maps may improve that internal fingerprint but source content and absolute build paths are not logged.

Required event families are limited to startup/migration/readiness/shutdown; HTTP request completion; authentication outcome without credential identity; command admission/result; Run state transition and Runtime load/dispose/failure; projection reconcile/rebuild/quarantine counts; prepared delete/recovery; SSE connect/disconnect/replay/reset/backpressure threshold; and prior-unclean/fatal process detection. Token deltas and ordinary successful tool phases never produce operational log entries.

### Sinks and retention

`info`, `warn`, and `error` events go to segmented JSONL files in the platform Logs root. Total retained encoded size is a hard **50 MiB capacity ring**: rotation deletes the oldest complete segment before admitting a new one, while preserving the current segment. There is no time-retention promise, debug level, remote upload, or telemetry exporter in v1.

The terminal receives concise human startup, shutdown, lock-conflict, and fatal summaries, not a duplicate stream of all JSON records. The one-time bootstrap URL uses a separate startup-instruction writer and never enters logging. Log write/rotation failure falls back to bounded stderr reporting and a readiness warning; logging failure alone must not crash an otherwise safe Gateway.

Logs use user-only permissions where supported. They are not imported into SQLite or exposed through an HTTP file endpoint. Routine cache cleanup never deletes them except through the logger's own 50 MiB rotation policy.

### Request and command correlation

Gateway generates a fresh `requestId` at the trusted HTTP boundary, returns it in `X-Request-Id`, places it in RFC 9457 Problems, and carries it through diagnostic context. Untrusted incoming request IDs are not adopted as the primary ID. Mutations additionally correlate their client-generated `commandId`; Run work correlates opaque `sessionId`/`runId`. No OTel SDK, trace/span identity, or cross-process propagation is introduced in v1.

HTTP logs use the matched low-cardinality route template, method, status class/code, and duration. They never use the raw URL path as a route label and never log query strings. Authentication failures are rate/summary observable but contain no cookie, Origin value, path proposal, or Principal credential.

### Liveness and readiness

The contract registry defines two fixed, minimal GET endpoints after the same exact loopback authority and browser-request validation used elsewhere:

- `/api/v1/health/live` returns 200 with only `{ status: "live" }` when the process event loop can serve the request; it does not inspect SQLite, Pi, projections, or provider auth.
- `/api/v1/health/ready` returns 200 `{ status: "ready" }`, or 503 with a bounded non-secret code: `starting`, `migrating`, `reconciling`, `shutting_down`, or `unavailable`.

These probes are unauthenticated so the CLI can verify startup, but disclose no version, epoch, path, dependency, error text, counts, or capabilities. They still require exact Host and Fetch Metadata policy; CORS remains disabled. Authenticated Bootstrap remains the only capability/readiness detail resource. A quarantined individual Session or unavailable provider does not make the whole Gateway unready; failure of migration, application database, instance ownership, or global projection generation does.

### Crash marker

At process ownership acquisition, Gateway atomically writes a bounded marker under the State root containing build revision, Gateway epoch, start time, and `running` status. Clean bounded shutdown atomically changes it to `clean` with finish time. A still-running marker found after exclusive lock acquisition means the previous owner exited uncleanly: startup emits `process.previous_unclean`, applies the established interrupted-Run/prepared-operation recovery, then replaces the marker.

Use `uncaughtExceptionMonitor` only to synchronously append a safe fatal fingerprint/marker while preserving Node's default nonzero exit. Do not install an `uncaughtException` handler that attempts to continue from undefined process state. Unhandled rejections retain Node's fatal default. Controlled fatal conditions use the established bounded shutdown; catastrophic crashes rely on next-start recovery.

Automatic Node diagnostic reports, core dumps, raw stacks, and Pi debug logs are disabled/not collected by the product. They may contain environment variables, command lines, paths, messages, or network data and therefore are outside the Minimum Safe Diagnostic Surface.

### User-visible recovery

The UI has no generic Diagnostics page in v1. Existing route/query/Sync Controller surfaces translate only stable safe states into a short explanation and one next action:

- Gateway `starting/migrating/reconciling`: wait and retry readiness;
- `reconnecting/recovering/offline`: preserve stale content and reconnect or bootstrap again;
- protocol incompatibility: upgrade the client/CLI rather than retrying blindly;
- provider auth required/interrupted: open or restart the AuthFlow;
- Unavailable or Quarantined Session: deny commands and offer retry reconciliation, safe diagnosis reference, or delete;
- Run `failed` or `interrupted`: show its safe code, retain retryable prompt ownership already defined, and offer explicit retry/discard;
- storage/permission/migration failure: stop admission and direct the user to the local log directory and `requestId`.

Problems and recovery views show stable code, retryability, and request ID but no stack, canonical path, raw Pi exception, or secret. Healthy state remains quiet; minimum recovery state does not become a permanent operations panel.

### Minimal Run and SSE visibility

Durable Run state, timestamps, safe terminal code, retry relationship, and existing inline tool/phase UI are sufficient for v1. Operational logs record only significant lifecycle transitions and failures. No separate Run diagnostic resource, persisted phase timeline, or inspection dashboard is added.

The Gateway logs bounded SSE replay count/range category, reset reason, connected-client count changes, and backpressure threshold crossings. SSE has no application acknowledgement, so the server must not claim to know client-applied lag. No Prometheus endpoint, histogram API, OTel exporter, browser telemetry, or retained metrics database is provided.

Session recycle count and total bytes are computed at startup/reconciliation and emitted as one bounded safe diagnostic event because automatic purge is disabled; there is no storage dashboard.

### Explicitly deferred beyond v1

A support-bundle generator, downloadable logs, diagnostics UI/API, Prometheus/OTLP export, distributed traces, resource/performance dashboards, detailed Run inspector, durable phase history, browser error telemetry, raw Node diagnostic report workflow, and automated recycle management are outside the first-release destination. They require a fresh scoped effort if operational evidence later justifies them.

Research asset: [Safe diagnostics, Node crash behavior, health semantics, and Pi observability](../research/diagnostics-and-operational-visibility.md).
