# no-pi-no-gang v2 architecture

## Destination

形成一份可直接交给实现阶段的 v2 首期架构规格：本地单用户 Vue 工作台，以 Pi 为 Agent 底座，完整覆盖 Workspace、基础 Session 生命周期、并行流式对话、模型与认证管理；在动工前不再留下架构级未决问题。

## Notes

- Domain: local-first Pi coding-agent workbench.
- Tracker: local Markdown under this directory.
- Every session should consult `codebase-design` and `domain-modeling`; UI tickets also consult `prototype`; external technology facts use `research`.
- This map plans decisions only. Feature implementation starts after the map is exhausted.
- Existing project `../no-pi-no-gang` is behavioral evidence only; v2 production code and contracts are greenfield.
- Research assets live under [`research/`](research/).

## Decisions so far

- [Set the v2 architecture baseline](issues/01-set-v2-architecture-baseline.md) — Local Vue SPA talks to one modular Node Agent Gateway that embeds Pi SDK; scope, concurrency, security, distribution, testing, and greenfield rules are fixed.
- [Choose Session persistence ownership](issues/02-choose-session-persistence-ownership.md) — Pi JSONL owns Session truth; SQLite owns application data and rebuildable projections; live deltas remain transient.
- [Choose multi-Session realtime transport](issues/03-choose-multi-session-realtime-transport.md) — REST carries commands and one Gateway-level SSE multiplexes every Session with cursor, replay, gap, and backpressure semantics.
- [Choose the UI foundation and design constraints](issues/04-choose-ui-foundation-and-design-constraints.md) — A Google-format, Notion-derived light/dark DESIGN.md governs project-owned Reka/shadcn-vue components and Tailwind v4 semantic tokens.
- [Choose the SQLite stack](issues/09-choose-sqlite-stack.md) — Built-in SQLite and immutable numbered SQL migrations avoid native addons; the product enforces Node 22.19+ to satisfy the stricter Pi runtime floor.
- [Choose the message rendering stack](issues/11-choose-message-rendering-stack.md) — Safe markdown-it tokens become AIcss-inspired project-owned Vue transcript components; Shiki highlights lazily while raw HTML and premature virtualization remain excluded.
- [Define the Runtime lifecycle model](issues/05-define-runtime-lifecycle-model.md) — A deep command coordinator owns durable Run admission, per-Session FIFO actors, bounded fair concurrency, explicit steer/cancel, lazy Pi Runtime residency, and settled-plus-durable terminal boundaries without automatic replay.
- [Define the Gateway contract model](issues/06-define-gateway-contract-model.md) — Schema-first `/api/v1` resources, commands, bounded snapshots, typed SSE, Problem Details, compatibility rules, and a registry-backed grouped client form the transport-neutral public seam.
- [Define Session projection and reconciliation](issues/07-define-session-projection-reconciliation.md) — A deep projection coordinator auto-discovers authorized Pi Sessions, builds generation-switched SQLite views with durable cursors and explicit health states, and performs recoverable tombstoned deletion without creating a second Session truth.
- [Define local authentication and Workspace authorization](issues/08-define-local-auth-and-workspace-authorization.md) — Exact loopback authority checks, one-time fragment bootstrap, process-scoped Cookie/CSRF, stable Local Principal grants, canonical realpath registration, and a transport-neutral access seam protect Gateway resources.
- [Prototype the workbench shell](issues/10-prototype-apple-workbench-shell.md) — A Notion-styled three-region shell keeps Workspace, Session, and conversation ownership visible; narrow screens use sheets and Codex-like Agent activity stays inline.
- [Define the Vue state interfaces](issues/12-define-vue-state-interfaces.md) — Router owns selected IDs, Vue Query owns durable REST facts, one partitioned Pinia store owns Live Overlays, and a single Sync Controller performs revision-aware SSE projection and snapshot recovery.
- [Define package and data layout](issues/13-define-package-and-data-layout.md) — Four coarse workspaces build one npm CLI artifact; platform-native app data stays separate from Pi, each data root has one Gateway owner, and shutdown/sidecar boundaries remain process-safe.
- [Define diagnostics and operational visibility](issues/14-define-diagnostics-and-operational-visibility.md) — V1 keeps only a Minimum Safe Diagnostic Surface: allow-listed 50 MiB logs, request correlation, minimal health probes, crash markers, and actionable recovery states without content capture.
- [Define upgrade and rollback policy](issues/16-define-upgrade-and-rollback-policy.md) — V1 uses forward-only migrations, three verified SQLite backups, fail-closed schema gates, explicit CLI restore, and a compatibility gate instead of copying Pi-owned data.
- [Define the acceptance architecture](issues/15-define-acceptance-architecture.md) — A critical-scenario matrix gates four vertical milestones, with full Linux verification, three-platform package smoke, real Pi compatibility, and deterministic browser/security/recovery tests.

## Not yet specified


## Out of scope

- Session Fork, tree navigation, import, attachments, multimodal input, Skills management, file preview/browser, PTY, and terminal emulation.
- A desktop application, remote multi-user service, tenant model, relay, or cloud control plane; desktop and remote remain compatibility constraints only.
- Multiple Agent providers or a provider-neutral durable Session model; Pi is the sole Agent foundation for v2 first release.
- A permanent token-delta event store, deterministic tool-step replay engine, or automatic replay of interrupted Runs.
- Visual or behavioral parity with the old React/Next implementation.
- OS-level filesystem or process sandboxing for Pi tools; Workspace authorization protects Gateway resources but does not confine `bash`, extensions, or child processes ([Define local authentication and Workspace authorization](issues/08-define-local-auth-and-workspace-authorization.md)).
- Search beyond the first-release SQLite FTS projection; revisit only after measuring real large-history corpora.
- Diagnostics dashboards/APIs, support bundles, downloadable logs, Prometheus/OTLP export, distributed tracing, retained metrics, detailed Run inspectors, browser telemetry, raw Node reports, and automated recycle management; v1 keeps only the Minimum Safe Diagnostic Surface.
- Automatic updates/restores, down migrations, scheduled/compressed/cloud backups, read-only downgrade servers, Pi Agent Root snapshots, and rollback across an unapproved Pi compatibility barrier.
- Global test-coverage percentages, exhaustive three-platform/full-browser duplication, pixel-perfect screenshot gates, and credential-backed Provider calls as deterministic CI blockers.
