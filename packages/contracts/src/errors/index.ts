export type ErrorCode =
  | "COMMAND_ID_CONFLICT"
  | "INVALID_EXECUTION_PROFILE"
  | "INVALID_SESSION_CURSOR"
  | "INVALID_RUN_STATE"
  | "WORKSPACE_ACCESS_DENIED"
  | "SESSION_NOT_FOUND"
  | "RUN_NOT_FOUND"
  | "INVALID_BOOTSTRAP"
  | "UNAUTHENTICATED";

export class CommandConflictError extends Error {
  readonly code: ErrorCode = "COMMAND_ID_CONFLICT";
  constructor() {
    super("commandId was already used with a different payload");
  }
}
