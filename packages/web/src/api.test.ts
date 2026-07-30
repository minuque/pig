import { describe, expect, it } from "vitest";
import { ApiError, errorMessage } from "./api.js";

describe("errorMessage", () => {
  it("keeps the API code and stable request association actionable", () => {
    const message = errorMessage(new ApiError("WORKSPACE_ACCESS_DENIED", "request-7"));
    expect(message).toContain("WORKSPACE_ACCESS_DENIED");
    expect(message).toContain("request-7");
    expect(message).toContain("重试");
  });
});
