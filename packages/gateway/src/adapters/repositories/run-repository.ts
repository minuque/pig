import { terminalStatuses, type Run, type RunId, type RunRepository } from "@pig/contracts";

export class InMemoryRunRepository implements RunRepository {
  private readonly runs = new Map<RunId, Run>();
  async findById(id: string) {
    return this.runs.get(id as RunId);
  }
  async save(run: Run) {
    const previous = this.runs.get(run.id);
    if (previous && terminalStatuses.has(previous.status) && run.status !== previous.status)
      return previous;
    this.runs.set(run.id, run);
    return run;
  }
  async transition(id: RunId, from: Run["status"][], next: Run) {
    const current = this.runs.get(id);
    if (!current || !from.includes(current.status)) return;
    this.runs.set(id, next);
    return next;
  }
  async delete(id: string) {
    return this.runs.delete(id as RunId);
  }
  async findAll() {
    return [...this.runs.values()];
  }
}
