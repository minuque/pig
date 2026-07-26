# Define the Vue state interfaces

Type: grilling
Status: resolved
Blocked by: 05, 06, 10, 11

## Question

What feature boundaries and small interfaces should separate Vue Query snapshots, Pinia live Session state, SSE reduction, route-owned resource identity, and component-local UI state while supporting multiple parallel Sessions without duplicated ownership?

## Answer

The client uses four exclusive ownership zones: **Vue Router owns selected resource identity; TanStack Vue Query owns refetchable server facts; one Pinia setup store owns transient Live Overlays; components or one in-memory draft registry own UI input state**. No state is copied merely to make it easier to access.

A single deep **Gateway Sync Controller** sits between the transport-neutral `GatewayClient` and those zones. It is the only consumer of the Gateway-level SSE stream and the only module that knows cursor replay, epoch changes, event deduplication, snapshot recovery, and how authoritative events affect Query versus Pinia.

### Route-owned identity

Named routes own only the selected `workspaceId` and optional `sessionId`. Query keys and view selectors derive those opaque IDs directly from specific route params; no Pinia store mirrors `currentWorkspace` or `currentSession`. Reused route components watch the individual params rather than the whole route object.

Session search text, list filters, tool expansion, navigation sheets, dialogs, scroll position, copy feedback, model picker visibility, and reconnect banners do not enter the URL in v1. Settings and provider-auth surfaces may have their own named routes, but workbench UI state is not encoded into query parameters or navigation history.

Invalid, missing, unauthorized, or Workspace-mismatched IDs resolve through normal Query errors and route-level recovery views. Components never parse IDs or infer Workspace relationships from their string form.

### Vue Query: durable server state

Vue Query is the sole owner of every value that REST can refetch: Bootstrap metadata, Workspace resources/lists, Session resources/lists, durable Transcript pages, Run resources, models, provider-auth status, and AuthFlow resources. These values are never copied into Pinia.

A project-owned query-key factory is the only place that constructs keys. Every request-affecting identity, filter, and opaque pagination cursor participates in its key. Feature query modules own the GatewayClient call, consume Query's `AbortSignal`, set bounded stale/cache policy, and expose domain-named composables; components do not call the client or construct keys directly.

Authoritative SSE events are projected into Query through one internal durable-event projector:

- a full resource event replaces matching detail/summary cache entries only when its revision is newer;
- affected list queries are immutably patched when membership and ordering are provably unchanged, otherwise invalidated;
- `transcript.item.committed` appends only to a loaded compatible tail page, deduplicated by `entryId`; unknown pagination shape causes invalidation rather than guessing;
- removal events delete detail cache and invalidate every containing list;
- unknown future business events advance the stream cursor but do not mutate known cache.

Session snapshots and Bootstrap recovery payloads are reconciliation inputs, not a second long-lived display cache. The Sync Controller splits their durable portions into the normal Query keys and their partial Run portions into Live Overlays.

### Pinia: transient Live Overlays

One app-scoped Pinia setup store owns:

```text
connection: connecting | reconnecting | recovering | live | offline
cursor / gatewayEpoch
bySession[sessionId].byRun[runId]:
  lastRunSeq, output text/thinking buffers, tool progress, transient phase
```

The store does not own durable Session/Run summaries, Transcript items, model/auth resources, route selection, composer drafts, or component display flags. It retains overlays for every nonterminal parallel Run, including unselected Sessions, so the Session list can show activity and switching is immediate.

All business-event application goes through a framework-free pure reducer conceptually shaped as `reduceLiveOverlay(previous, event) -> next`. It enforces Gateway cursor, epoch, `runSeq`, append/replace semantics, duplicate delivery, and per-Session isolation without importing Vue, Pinia, Query, EventSource, or components. The Pinia action performs one patch with the reducer's result.

A committed Transcript item and terminal Run resource do not clear provisional output until their newer durable values are installed in Query. The controller then removes the matching overlay by durable entry/Run identity, preventing a flash or duplicated assistant message. Terminal overlays are evicted after that durable boundary; nonterminal overlays are never removed by LRU pressure.

### Gateway Sync Controller

The application creates exactly one Controller after authenticated bootstrap and disposes it on auth loss or application shutdown. Session pages and feature stores never open their own streams. Its small lifecycle interface is equivalent to:

```ts
interface GatewaySyncController {
  start(): void
  stop(): Promise<void>
  recover(reason: StreamResetReason): Promise<void>
}
```

Internally it owns the EventClient `AsyncIterable`, AbortController/effect scope, last accepted cursor, durable-event projector, pure live reducer, and recovery coordinator. Network retry remains in the EventClient adapter; semantic replay/reset decisions remain in the Controller. Cleanup explicitly aborts the stream—Pinia or Vue scope disposal alone is not assumed to close network resources.

Normal duplicate events are discarded by Gateway cursor, resource revision, durable `entryId`, and `runSeq` as appropriate. Events for different Sessions may interleave globally but mutate only their keyed partition. No selected-Session global variable participates in reduction.

### Reset and gap recovery

`stream.reset`, an epoch change, or a known-event decode failure starts two-phase recovery:

1. stop accepting business events and mark connection `recovering`;
2. retain the currently rendered Query data and overlays but mark the view stale, rather than blanking all Sessions;
3. fetch a new Bootstrap plus snapshots for the route-selected Session and every Session with a nonterminal Run;
4. stage durable cache updates and replacement overlays, then publish them as one logical recovery commit;
5. reopen the stream strictly after the snapshots' captured cursor and return to `live`.

If recovery fails, the old view remains visibly stale/read-only and retryable; commands that cannot prove current preconditions remain disabled. The client never continues reducing across a known gap and never tries to replay missing token deltas from local state.

### View composition

Each feature exposes one read-only selector/composable such as `useSessionView(sessionId)`. It combines Query's durable Session/Transcript/Run values with the matching Pinia overlay into a stable project-owned ViewModel. It owns loading/error/recovering semantics, provisional-versus-committed deduplication, current phase, and “jump to latest” state inputs.

Page-level containers may call feature composables. Transcript messages, tool rows, Session rows, headers, and composer controls receive typed props and emit intents; they do not independently read both Query and Pinia. A durable snapshot is never copied into Pinia to create a convenient single store.

### Commands and drafts

Mutations use a uniform **optimistic command UI, authoritative domain result** rule:

- `useMutation` state immediately shows submitting/disabled feedback;
- no Run state, resource revision, deletion, rename, or provider-auth result is fabricated before the Gateway response;
- an accepted `MutationResult` immutably seeds its returned resource/result into Query or the relevant overlay;
- subsequent SSE delivery converges by `commandId`, resource revision, and Run identity;
- errors restore only command UI and retain user input.

The composer uses a separate in-memory draft registry keyed by `sessionId`. It retains text, selected model, and thinking level while switching Sessions, but is not part of the Live Overlay store, Query cache, Router, localStorage, or SQLite. A draft clears only after Run admission returns accepted/applied/replayed. API keys, OAuth answers, and other write-only secrets remain component-local input refs and are cleared on submission; they never enter Query, Pinia, devtools persistence, or draft storage.

All other transient interaction state stays at the lowest component that needs it. State lifts to a page composable only when multiple descendants coordinate; it becomes app-scoped only when it must survive route replacement or represent multiple Sessions.

### Feature seams

The initial client modules are shaped around behavior rather than technical pass-through wrappers:

- route identity: validates and exposes selected opaque resource IDs;
- query key factory plus Workspace, Session, Run, model, provider-auth, and AuthFlow query/command composables;
- Gateway Sync Controller with internal durable projector and recovery coordinator;
- pure Live Overlay reducer plus one Pinia adapter;
- Session View selector/composable;
- in-memory composer draft registry.

These are internal seams, not additions to the wire contract. The GatewayClient remains the only transport interface. Avoid generic repository/hooks layers, event buses, one store per Session, and wrappers that merely rename Query or Pinia methods.

### Verification

Reducer tests feed interleaved, duplicated, out-of-order, commit, terminal, epoch, and unknown-event sequences without mounting Vue. Durable projector tests use a real in-memory QueryClient and assert immutable revision-aware updates/invalidation. Controller tests use a fake async EventClient to verify one connection, abort cleanup, reset staging, snapshot cursor handoff, and multi-Session isolation. Selector tests combine Query fixtures and overlays to prove no duplicate Transcript output and no cross-Session leakage.

Research asset: [Vue state ownership and library behavior](../research/vue-state-boundaries.md).
