import { CommandConflictError } from "../errors/index.js";
import type { CommandId } from "../resources/index.js";

export interface CommandExecutor {
  execute<T>(commandId: CommandId, payload: unknown, operation: () => Promise<T>): Promise<T>;
}
export class InMemoryCommandExecutor implements CommandExecutor {
  private readonly commands = new Map<CommandId, { payload: string; result: Promise<unknown> }>();
  execute<T>(commandId: CommandId, payload: unknown, operation: () => Promise<T>): Promise<T> {
    const serialized = JSON.stringify(payload);
    const previous = this.commands.get(commandId);
    if (previous) {
      if (previous.payload !== serialized) throw new CommandConflictError();
      return previous.result as Promise<T>;
    }
    const result = operation();
    this.commands.set(commandId, { payload: serialized, result });
    return result;
  }
}
