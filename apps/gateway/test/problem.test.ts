import { describe, expect, it } from "vitest";
import { ProblemDetailsSchema } from "@no-pi-no-gang/contracts";
import { problem } from "../src/problem.js";

describe("problem details factory", () => {
  it("produces contract-valid server errors marked retryable", () => {
    const parsed = ProblemDetailsSchema.parse(problem("server.unavailable", 503, "req_1"));
    expect(parsed.code).toBe("server.unavailable");
    expect(parsed.status).toBe(503);
    expect(parsed.retryable).toBe(true);
    expect(parsed.requestId).toBe("req_1");
  });

  it("produces contract-valid client errors marked non-retryable with details", () => {
    const parsed = ProblemDetailsSchema.parse(
      problem("run.not_found", 404, "req_2", { runId: "run_1" }),
    );
    expect(parsed.retryable).toBe(false);
    expect(parsed.details).toEqual({ runId: "run_1" });
  });
});
