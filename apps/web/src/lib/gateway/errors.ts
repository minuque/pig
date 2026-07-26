import type {
  GatewayClientErrorKind,
  ProblemDetails,
} from "@no-pi-no-gang/contracts";

export class GatewayRequestError extends Error {
  readonly kind: GatewayClientErrorKind;
  readonly problem: ProblemDetails | undefined;

  constructor(
    kind: GatewayClientErrorKind,
    message: string,
    problem?: ProblemDetails,
  ) {
    super(message);
    this.name = "GatewayRequestError";
    this.kind = kind;
    this.problem = problem;
  }

  static fromProblem(problem: ProblemDetails): GatewayRequestError {
    return new GatewayRequestError("problem", problem.detail, problem);
  }
}

/** Fatal SSE open failure carrying the Gateway Problem Details. */
export class GatewayStreamOpenError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = "GatewayStreamOpenError";
    this.problem = problem;
  }
}

export function isAuthProblem(error: unknown): boolean {
  return (
    error instanceof GatewayRequestError &&
    error.kind === "problem" &&
    (error.problem?.code === "auth.unauthenticated" ||
      error.problem?.code === "auth.csrf_invalid" ||
      error.problem?.code === "auth.forbidden" ||
      error.problem?.code === "auth.bootstrap_invalid")
  );
}
