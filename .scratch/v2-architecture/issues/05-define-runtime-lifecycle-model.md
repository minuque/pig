# Define the Runtime lifecycle model

Type: grilling
Status: resolved
Blocked by:

## Question

What product-level lifecycle, state machine, invariants, and small interface should isolate Pi AgentSession creation/resume/disposal while preserving one active execution per Session, cross-Session concurrency, queueing, interruption, and durable-entry boundaries?

## Answer

`SessionRuntimeCoordinator` is the deep module at the Gateway-to-Pi seam. Hono routes, Vue clients, and contract DTOs do not hold Pi `AgentSession` references or reproduce lifecycle logic.

```ts
interface SessionRuntimeCoordinator {
  dispatch(command: RuntimeCommand): Promise<CommandReceipt>
  snapshot(sessionId: SessionId): Promise<RuntimeSnapshot>
  shutdown(): Promise<ShutdownReport>
}

type RuntimeCommand =
  | { kind: "createRun"; commandId: CommandId; sessionId: SessionId; prompt: PromptInput }
  | { kind: "steerRun"; commandId: CommandId; runId: RunId; input: SteerInput }
  | { kind: "cancelRun"; commandId: CommandId; runId: RunId }
```

`dispatch` returns after durable command admission, not after Pi starts or finishes. `snapshot` returns the active Run, FIFO queue, durable Run states, and latest confirmed Pi cursor; token deltas remain in the realtime layer. `shutdown` owns the fixed process-drain policy. Pi adapters, the pending-command store, clock, reducer, per-Session actors, scheduler, and event publisher are internal seams.

Every ordinary prompt creates a distinct `Run`. The public states are:

```text
queued -> starting -> running -> completed
   |          |          |  -> failed
   |          |          -> cancelling -> cancelled
   +----------+--------------------------> cancelled

any nonterminal -- lost/uncertain invariant --> interrupted
```

The terminal states are immutable. Retry always creates a new Run with `retryOfRunId`; no terminal Run is reopened. `failed` means a known execution failure that ended with a trustworthy Runtime and persistence boundary. `interrupted` means the Gateway cannot prove completion or cancellation; interrupted Runs are never replayed automatically.

Before Pi accepts a prompt, a queued cancellation or known startup rejection may terminate from the application transaction alone. After Pi accepts it, `completed`, `failed`, or `cancelled` requires Pi to be settled and the resulting JSONL leaf/cursor to be confirmed. A SQLite Session Projection need not be current. Tool failures, provider retries, compaction, and tool activity are phase events, not additional Run states.

Each Session owns one internal actor and zero or one resident Pi Runtime. Runtime implementation states are `unloaded`, `loading`, `idle`, `executing`, `disposing`, and `faulted`; they are not contract states. Creation/resume is lazy and single-flight. A Runtime with no active or queued Run starts a five-minute idle timer, after which it is disposed. New work cancels that timer. Browser routes, tabs, snapshots, and SSE subscribers never pin a Runtime.

Scheduling obeys these invariants:

- one Session has at most one active Run and one Pi Runtime writer;
- ordinary Runs are FIFO by durable admission ordinal, with at most 32 queued Runs per Session by default;
- the Gateway permits at most four cross-Session active Runs by default; the limit is configurable and exposed as a capability;
- each Session contributes only its oldest queue head to the global scheduler, and candidates acquire permits by global admission ordinal;
- a permit is held from `starting` through the Run terminal transition;
- one Session's load, execution, abort, persistence, or disposal failure never blocks another Session;
- Pi native `followUp` is not the product queue and is not used to represent another Run.

`steerRun` is an explicit control command against the current `running` Run. It maps to Pi steering, creates no Run, is rejected for idle, queued, starting, cancelling, or terminal targets, and is never substituted for an ordinary prompt based on timing. `cancelRun` affects only its target: a queued Run becomes `cancelled`; a starting Run is cancelled directly if Pi has not accepted it; an accepted/running Run enters `cancelling` and invokes Pi abort. Other queued Runs remain FIFO and continue only after a trustworthy settled/durable boundary.

Normal cancellation has a ten-second deadline. If Pi settles and durability is confirmed, the Run becomes `cancelled` and the next Run may start. On timeout or any other loss of Runtime invariants, the target and every nonterminal Run for that Session become `interrupted`, the Runtime is disposed, and no queue item starts automatically. A cleanly settled execution failure may become `failed` and allow the queue to continue; an uncertain failure may not.

Command admission and recovery are durable but not a second Session store:

- every mutating command requires a client `commandId`;
- the same key and payload returns the original receipt; the same key with a different payload is an idempotency conflict;
- `createRun` atomically stores the Run, pending prompt, admission ordinal, and receipt in SQLite before publishing acceptance or adding in-memory work;
- pending content is an execution command, not a Session message; it is removed after the corresponding Pi entry is durably correlated, while interrupted pre-durable content remains available for explicit retry or discard;
- state changes commit before lifecycle events publish; a lost event is recovered from `snapshot`;
- Gateway startup atomically changes every leftover nonterminal Run, including queued Runs, to `interrupted`; it never resumes them automatically.

The coordinator's domain rejection reasons are `queue_full`, `run_not_found`, `invalid_run_state`, `idempotency_conflict`, `session_unavailable`, and `admission_closed`. The Gateway contract may version and transport these errors but cannot change their lifecycle meaning.

Graceful shutdown closes admission first, changes queued Runs to `interrupted`, and aborts active Runs concurrently. It waits at most ten seconds total for settled/durable confirmation, records clean aborts as `cancelled`, records the rest as `interrupted`, disposes every Runtime, and only then allows stores and realtime infrastructure to close.
