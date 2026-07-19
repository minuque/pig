# Set the v2 architecture baseline

Type: grilling
Status: resolved
Blocked by:

## Question

What product scope, process topology, module shape, concurrency model, security boundary, distribution path, and implementation strategy should define v2 before deeper design begins?

## Answer

The first release is a local single-user workbench covering explicit Workspace registration, basic Session lifecycle (list/create/resume/rename/delete), complete streaming conversation, and Pi-native model/auth management. It does not promise old-product parity.

The production topology is:

```text
Vue 3 + Vite SPA
        │ REST + SSE
Hono Node Agent Gateway
        │ direct SDK integration
Pi coding-agent
```

The Gateway is one process and a modular monolith. Vue and Pi never share types directly; `packages/contracts` owns versioned Zod 4 schemas and a typed client consumes them. The frontend uses Vue Router, TanStack Vue Query for REST snapshots, Pinia for live domain state, and feature-oriented source layout.

A Session permits at most one active execution; different Sessions may execute concurrently. Pi runtimes restore on demand and are disposed after idle periods. Interrupted executions are surfaced as interrupted and never automatically replayed.

The local server binds loopback on a random port, uses a one-time bootstrap token exchanged for a secure cookie, validates Host/Origin, disables CORS by default, and authorizes canonical Workspace roots. Distribution is an npm CLI that starts the Gateway and serves the built SPA.

Implementation is greenfield. The old repository may inform behavioral tests and failure cases but no production code, package shape, or contract is copied. Verification is contract- and integration-first.
