export class CommandConflictError extends Error {
  constructor() {
    super("commandId was already used with a different payload");
  }
}
