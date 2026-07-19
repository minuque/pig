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
- [Choose the UI foundation and design constraints](issues/04-choose-ui-foundation-and-design-constraints.md) — Apple-derived light/dark DESIGN.md with project-owned Reka/shadcn-vue components and Tailwind v4 semantic tokens.
- [Choose the SQLite stack](issues/09-choose-sqlite-stack.md) — Node 22.16+ built-in SQLite and immutable numbered SQL migrations avoid native addons while providing FTS5 and transactional startup migration.
- [Choose the message rendering stack](issues/11-choose-message-rendering-stack.md) — Safe markdown-it tokens become project-owned Vue VNodes; Shiki highlights lazily; raw HTML and premature virtualization remain excluded.
- [Define the Runtime lifecycle model](issues/05-define-runtime-lifecycle-model.md) — A deep command coordinator owns durable Run admission, per-Session FIFO actors, bounded fair concurrency, explicit steer/cancel, lazy Pi Runtime residency, and settled-plus-durable terminal boundaries without automatic replay.
- [Define the Gateway contract model](issues/06-define-gateway-contract-model.md) — Schema-first `/api/v1` resources, commands, bounded snapshots, typed SSE, Problem Details, compatibility rules, and a registry-backed grouped client form the transport-neutral public seam.

## Not yet specified

- The application upgrade and rollback policy cannot be finalized until package/data layout and npm lifecycle are decided.
- The exact phased implementation cut depends on the final contract, UI prototype, and acceptance architecture.
- Large-history search beyond SQLite FTS may need revisiting only after real corpus measurements.

## Out of scope

- Session Fork, tree navigation, import, attachments, multimodal input, Skills management, file preview/browser, PTY, and terminal emulation.
- A desktop application, remote multi-user service, tenant model, relay, or cloud control plane; desktop and remote remain compatibility constraints only.
- Multiple Agent providers or a provider-neutral durable Session model; Pi is the sole Agent foundation for v2 first release.
- A permanent token-delta event store, deterministic tool-step replay engine, or automatic replay of interrupted Runs.
- Visual or behavioral parity with the old React/Next implementation.
