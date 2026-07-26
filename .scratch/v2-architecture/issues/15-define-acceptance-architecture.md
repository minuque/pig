# Define the acceptance architecture

Type: grilling
Status: resolved
Blocked by: 06, 07, 08, 10, 12, 13, 14, 16

## Question

Which contract, Gateway integration, real-Pi compatibility, Pinia, accessibility, Playwright, concurrency, reconnect, backpressure, security, packaging, and cross-platform scenarios must pass before the v2 first-release architecture is considered implementable and complete?

## Answer

V2 uses a **critical-scenario acceptance matrix**, not a global coverage percentage. Every architectural invariant below has one owning test layer and is release-blocking unless explicitly marked canary. Tests exercise the same deep module interfaces as production callers; they do not expose implementation internals merely to improve coverage.

The minimum test stack is Vitest for contracts/modules and real-process integration, Vue Test Utils for focused Vue behavior, Playwright for browser journeys, and project-owned adapters/fixtures in `packages/testkit`. SQLite is always real in integration tests. Broad screenshot baselines, exhaustive browser/platform duplication, and live-provider network calls on every change are deliberately avoided.

### Test layers and gates

| Layer | Required scope | When it blocks |
|---|---|---|
| Contract | Registry completeness, Zod accept/reject fixtures, resource/event revisions, Problem codes, typed-client request/response agreement, route-template uniqueness | Every change |
| Module | Pure state machines and policies through their public interfaces: Run coordinator, projection coordinator, access policy, Sync Controller, rendering and diagnostic allow-list | Every change |
| Gateway integration | Real Node process or in-process composition with real SQLite, temporary Application Data/Pi roots, actual loopback HTTP/SSE, deterministic clocks and Pi adapter | Every change |
| Real-Pi compatibility | Pinned real Pi SDK with an isolated Agent Root and deterministic local provider/model mechanism; Session JSONL is created and reopened by Pi itself | Every change touching Pi integration, and every release |
| Browser acceptance | Installed SPA and Gateway through Playwright; Chromium runs the full critical journey, Firefox/WebKit run bootstrap/SSE/composer smoke journeys | Every release; focused Chromium journeys on changes |
| Packaged-platform smoke | The packed npm tarball installs and runs on Linux, Windows, and macOS | Every release |

Linux runs the complete suite. Windows and macOS run only the packaged smoke matrix: install the same tarball, reject an unsupported Node runtime, start on a native temporary data root, acquire the singleton lock, bootstrap/register a temporary Workspace, create and reopen one deterministic real-Pi Session, persist SQLite across restart, and perform bounded graceful shutdown. This is enough to verify platform directories, paths, locking, process signals, browser URL generation, SQLite, and Pi loading without tripling every E2E.

CI exercises the exact minimum Node 22.19.0 and the current supported LTS on Linux; platform smoke uses the current supported LTS. A future Node release is not claimed supported merely because `engines` has no upper bound: release CI must add it before support is asserted.

A credential-backed live Provider auth/generation canary may run manually or on a schedule before release. It reports upstream drift but is **not release-blocking** because secrets, quota, latency, and network availability are not deterministic. The blocking compatibility suite must still embed the actual pinned Pi package rather than replacing Pi with a Gateway-only fake.

### Required contract and security scenarios

The registry test enumerates every REST operation and SSE event and proves there is exactly one schema, authorization class, route template, typed-client method, success fixture, and expected Problem family for each. Unknown fields/types, stale revisions, invalid cursors, incompatible contract revisions, oversized pages and commands, and unknown event kinds fail in the documented direction.

Real-loopback integration must prove:

- exact Host/authority, Origin, Fetch Metadata and disabled-CORS policy reject DNS rebinding, cross-site requests, malformed authority, preflight and non-loopback forms before domain work;
- the fragment bootstrap secret never reaches HTTP/logs/history, expires, is single-use, and yields only the process-scoped HttpOnly SameSite cookie plus session-bound CSRF token; replay, missing CSRF, forged cookie, restart and logout/revocation all fail closed;
- Workspace preview/confirmation canonicalizes aliases and symlinks, rejects files/missing or unsafe roots, prevents ID substitution across Grants, and revokes access immediately on unregister;
- every Problem and diagnostic event is scanned with canary prompts, tool payloads, paths, headers, cookies, tokens, environment values and hostile CR/LF strings; none may escape the typed allow-list;
- liveness/readiness expose only their fixed bodies, and startup, migration, reconciliation and shutdown drive readiness through the specified bounded states.

### Required persistence, upgrade and recovery scenarios

Use real temporary files and subprocess termination where crash behavior matters:

- fresh database creation and every checked-in historical schema fixture migrate to latest; migration checksums are immutable; newer/foreign/corrupt databases refuse before HTTP or Pi starts;
- pre-migration Online Backup validates and retains at most three normal backups; injected backup/migration/post-check failure never reports readiness; explicit `backups restore` verifies and atomically restores the selected schema;
- process kill leaves an unclean marker, nonterminal Runs become interrupted after restart, prepared deletes reconcile idempotently, and no prompt is automatically replayed;
- append, partial final line, truncation, replacement, deletion, invalid JSONL and future/unsupported Pi content produce the specified cursor, rebuild, Unavailable or Quarantined state without mutating Pi truth;
- projection rebuild serves the old generation until the new generation validates and flips atomically; failure never exposes mixed generations;
- a Pi dependency update must pass the rollback-barrier fixture: the previous supported pinned Pi can reopen Session JSONL after the candidate Pi writes it.

### Required Runtime, concurrency and SSE scenarios

The deterministic Runtime adapter drives exact event sequences, delays and failures; a smaller mirrored suite confirms the pinned Pi adapter produces the normalized shape. Required scenarios are:

- one active Run per Session, FIFO queued Runs, fair bounded execution across Sessions, no starvation, and duplicate `commandId` replaying the original `MutationResult`;
- send, steer and cancel at every queued/active/settling edge; a Run becomes terminal only after Pi settles and the durable transition commits; late deltas cannot resurrect it;
- Runtime create/restore failure, provider auth interruption, tool failure, disposal and idle eviction preserve the defined Session/Run ownership;
- graceful shutdown stops admission, drains within the ten-second Runtime budget and fifteen-second process deadline, while a second signal forces exit;
- SSE cursors are monotonic, replay is ordered and bounded, duplicates are harmless, too-old/gap/epoch mismatch causes reset, and a slow client crosses backpressure policy without unbounded memory;
- disconnect during token/tool activity, reconnect after missed durable events, and Gateway restart all execute snapshot-plus-cursor recovery and atomically replace stale state without duplicate Transcript content.

No test claims server knowledge of client-applied lag because the SSE contract has no application acknowledgement.

### Required Vue and browser scenarios

Sync Controller tests feed duplicate, stale, reordered, gapped and reset event streams and prove that Router alone owns selected IDs, Vue Query owns REST-refetchable facts, and Live Overlay remains partitioned by Session/Run. `MutationResult` precedes durable domain change; stale overlays are discarded only after a validated snapshot; composer drafts stay in memory and remain isolated per Session.

Full Chromium Playwright journeys cover:

1. first launch, bootstrap exchange, Workspace confirmation and shell navigation;
2. Session list/create/resume/rename/recoverable delete and empty/loading/error states;
3. model selection and provider AuthFlow success, cancellation, expiry and restart;
4. streaming text/thinking/tool activity, queued parallel Sessions, steer, cancel, retry/discard interrupted work and reload;
5. offline/reconnect, replay, forced reset, unavailable/quarantined Session and protocol-incompatible recovery;
6. Notion-derived light/dark/system theme, narrow navigation sheets, long Transcript/code, reduced motion, AIcss-inspired inline thinking/tool/streaming/input states, and no-content diagnostics leakage.

Critical journeys run keyboard-only and assert visible focus, focus return after dialogs/sheets, semantic names, live-region behavior without token spam, 44px pointer targets, modal focus containment, and no serious axe violations in both themes. Focused component tests cover safe markdown links, disabled raw HTML, code overflow/copy behavior, user-content rendering, collapsed/expanded reasoning, tool status transitions and streaming completion. CI validates the pinned Google Labs `DESIGN.md` structure, token references, canonical section order and component contrast; representative DOM styles must resolve from mapped project tokens rather than ad hoc feature colors. Pixel-perfect screenshot approval is not a release gate.

### Packaging and diagnostic scenarios

`npm pack` installs into a clean temporary project and starts without repository sources or workspace links. Tests verify built SPA assets and immutable migrations are present, API/SSE never fall through to SPA routing, cached asset headers are correct, the random loopback port becomes ready before browser open/print, a second owner is rejected, and `--data-dir`, `--no-open`, help/version and maintenance commands have stable exit codes.

Diagnostic sink tests prove event shape closure, control-character safety, request/command correlation, terminal separation, log-write degradation and 50 MiB oldest-segment rotation. Crash subprocess tests verify only safe fingerprints and markers are retained. Tests may inject a smaller sink capacity through an internal adapter but production configuration remains fixed.

### Four implementation milestones

1. **Secure executable shell** — Google-format Notion-derived `DESIGN.md`, workspace graph, contracts/testkit, packed CLI, directories/lock, SQLite migration base, diagnostics, health, bootstrap/CSRF and Workspace registration. Exit gate: design lint, contract/security integration plus installed shell journey.
2. **Durable Session workbench** — real Pi settings/models/AuthFlow, discovery/projection/rebuild, Session lifecycle/search, transcript renderer, Router/Query shell and responsive navigation. Exit gate: real-Pi reopen, projection recovery and read-oriented Playwright journeys.
3. **Parallel live conversation** — durable Run admission, per-Session actors, Pi Runtime residency, send/steer/cancel, multiplexed SSE, Live Overlay and snapshot recovery. Exit gate: concurrency/backpressure/crash matrix plus full conversation journey.
4. **First-release hardening** — delete recovery, all user recovery states, accessibility, upgrade backup/restore, retention, packaged three-platform smoke and browser-engine smoke. Exit gate: the entire acceptance matrix passes from the packed artifact.

A milestone may hide unfinished routes; it may not ship placeholder interfaces that bypass the final seam. Tests and production callers share the contract registry, Runtime adapter seam, projection coordinator interface, access policy interface and Sync Controller interface. Test-only control is limited to dependencies that genuinely vary—clock, ID source, filesystem fault injection, deterministic Pi/provider adapter and process launcher—not repositories or pass-through wrappers.

### Completion rule

A release candidate is acceptable only when every applicable critical scenario passes from a clean checkout and packed artifact with no unexplained skip or quarantined flaky test. A rerun may collect diagnostics but does not turn an initial failure into a pass. The matrix, not a coverage percentage or manual demo, is the evidence that the architecture is implementable and complete.
