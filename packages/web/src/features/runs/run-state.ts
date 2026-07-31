import type { SSEEventEnvelope } from "@no-pi-no-gang/contracts";

export type RunStatus =
  "admission" | "queued" | "running" | "cancelling" | "completed" | "failed" | "cancelled";
export interface UiRun {
  id: string;
  workspaceId: string;
  sessionId: string;
  status: RunStatus;
  output: string;
}

export const terminalStatuses = new Set<RunStatus>(["completed", "failed", "cancelled"]);

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
  } else if (envelope.type === "run.running") run.status = "running";
  else if (envelope.type === "run.cancelling") run.status = "cancelling";
  else if (["run.completed", "run.failed", "run.cancelled"].includes(envelope.type)) {
    run.status = envelope.type.slice(4) as RunStatus;
  }
  return run;
}

export function transcriptText(entry: Record<string, unknown>): string {
  if (typeof entry.content === "string") return entry.content;
  if (typeof entry.text === "string") return entry.text;
  return JSON.stringify(entry, null, 2);
}
