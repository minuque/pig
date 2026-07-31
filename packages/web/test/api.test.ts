import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorMessage, streamEvents } from "../src/api/index.js";

afterEach(() => vi.restoreAllMocks());

describe("errorMessage", () => {
  it("keeps the API code and stable request association actionable", () => {
    const message = errorMessage(new ApiError("WORKSPACE_ACCESS_DENIED", "request-7"));
    expect(message).toContain("WORKSPACE_ACCESS_DENIED");
    expect(message).toContain("request-7");
    expect(message).toContain("重试");
  });

  it("reports SSE readiness only after the HTTP body is available", async () => {
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const opened = vi.fn();
    const streaming = streamEvents(() => undefined, new AbortController().signal, opened);
    expect(opened).not.toHaveBeenCalled();
    resolveFetch(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        {
          status: 200,
        },
      ),
    );
    await streaming;
    expect(opened).toHaveBeenCalledOnce();
  });
});
