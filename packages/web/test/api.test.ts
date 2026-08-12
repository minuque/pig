import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, bootstrapFromFragment, errorMessage, streamEvents } from "../src/api/index.js";

const CREDENTIAL_KEY = "pig.credential";
const STORAGE = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => STORAGE.get(key) ?? null,
  setItem: (key: string, value: string) => void STORAGE.set(key, value),
});

afterEach(() => {
  STORAGE.clear();
  vi.restoreAllMocks();
});

// 模块级 credential 在测试间共享，重新导入以隔离
async function freshApiModule() {
  vi.resetModules();
  return import("../src/api/index.js");
}

describe("credential persistence", () => {
  it("restores a persisted credential after reload", async () => {
    STORAGE.set(CREDENTIAL_KEY, "persisted-cred");
    const api = await freshApiModule();
    expect((api as unknown as { api: <T>(path: string) => Promise<T> }).api).toBeDefined();
    const header = await captureAuthHeader(api);
    expect(header).toBe("Bearer persisted-cred");
  });

  it("persists the credential after bootstrap", async () => {
    vi.stubGlobal("location", { hash: "#bootstrap=secret-1" });
    vi.stubGlobal("history", { replaceState: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ credential: "fresh-cred", identityId: "id" }), {
            status: 201,
          }),
      ),
    );
    const api = await freshApiModule();
    await api.bootstrapFromFragment();
    expect(STORAGE.get(CREDENTIAL_KEY)).toBe("fresh-cred");
  });
});

async function captureAuthHeader(api: typeof import("../src/api/index.js")) {
  let captured = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      captured = (init?.headers as Record<string, string> | undefined)?.authorization ?? "";
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );
  await api.api("/health");
  return captured;
}

describe("errorMessage", () => {
  it("keeps the API code and stable request association actionable", () => {
    const message = errorMessage(new ApiError("WORKSPACE_ACCESS_DENIED", "request-7"));
    expect(message).toContain("WORKSPACE_ACCESS_DENIED");
    expect(message).toContain("request-7");
    expect(message).toContain("重试");
  });

  it("explains an expired credential instead of a generic retry", () => {
    const message = errorMessage(new ApiError("UNAUTHENTICATED", "request-9"));
    expect(message).toContain("Gateway");
    expect(message).not.toContain("重试");
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
