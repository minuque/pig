import { describe, expect, it } from "vitest";
import { setStartupError, useStartupError } from "@features/startup/hooks/use-startup-error.js";

describe("startup error message", () => {
  it("stores the failure copy for the error route", () => {
    setStartupError("");
    expect(useStartupError().value).toBe("");
    setStartupError("凭证无效");
    expect(useStartupError().value).toBe("凭证无效");
  });
});
