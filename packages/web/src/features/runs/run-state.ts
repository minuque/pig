import {
  canTransition,
  terminalStatuses,
  type RunStatus,
  type SSEEventEnvelope,
} from "@no-pi-no-gang/contracts";

export type { RunStatus };
export { terminalStatuses };

export interface UiRun {
  id: string;
  workspaceId: string;
  sessionId: string;
  status: RunStatus;
  output: string;
}

export function queuePreResponseEvent(queue: SSEEventEnvelope[], event: SSEEventEnvelope) {
  if (queue.length < 50 || (event.type.startsWith("run.") && event.type !== "run.output.delta"))
    queue.push(event);
}

export function routeRunEvent(
  runs: Map<string, UiRun>,
  envelope: SSEEventEnvelope,
): UiRun | undefined {
  if (!envelope.runId || !envelope.workspaceId || !envelope.sessionId) return;
  const run = runs.get(envelope.runId);
  if (
    !run ||
    run.workspaceId !== envelope.workspaceId ||
    run.sessionId !== envelope.sessionId ||
    terminalStatuses.has(run.status)
  )
    return;
  if (envelope.type === "run.output.delta") {
    const text = (envelope.data as { text?: unknown })?.text;
    if (typeof text === "string") run.output += text;
  } else if (envelope.type === "run.running") {
    if (run.status && canTransition(run.status, "running")) {
      run.status = "running";
    }
  } else if (envelope.type === "run.cancelling") {
    if (run.status && canTransition(run.status, "cancelling")) {
      run.status = "cancelling";
    }
  } else if (["run.completed", "run.failed", "run.cancelled"].includes(envelope.type)) {
    const next = envelope.type.slice(4) as RunStatus;
    if (run.status && canTransition(run.status, next)) {
      run.status = next;
    }
  }
  return run;
}
