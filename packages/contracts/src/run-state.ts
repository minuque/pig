export type RunStatus = "queued" | "running" | "cancelling" | "completed" | "failed" | "cancelled";

export const terminalStatuses: ReadonlySet<RunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

const transitions: Record<RunStatus, readonly RunStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["cancelling", "completed", "failed"],
  cancelling: ["cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return transitions[from].includes(to);
}
