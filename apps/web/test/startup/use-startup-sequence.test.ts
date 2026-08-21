import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn(async () => undefined);
const currentRoute = { value: { name: undefined as string | undefined } };

vi.mock("vue-router", () => ({
  useRouter: () => ({ currentRoute, replace }),
}));

import { setStartupError, useStartupError } from "@features/startup/hooks/use-startup-error.js";
import { useStartupSequence } from "@features/startup/hooks/use-startup-sequence.js";

describe("startup sequence", () => {
  beforeEach(() => {
    setStartupError("");
    currentRoute.value = { name: undefined };
    replace.mockClear();
  });

  it("runs bootstrap, connect, then initialize without closing the overlay", async () => {
    const order: string[] = [];
    const { start, ready, visible } = useStartupSequence({
      bootstrap: async () => {
        order.push("bootstrap");
      },
      connect: async () => {
        order.push("connect");
      },
      initialize: async () => {
        order.push("initialize");
      },
      connectTimeoutMs: 0,
    });
    await start();
    expect(order).toEqual(["bootstrap", "connect", "initialize"]);
    expect(ready.value).toBe(true);
    expect(visible.value).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves the error route after a successful boot", async () => {
    currentRoute.value = { name: "error" };
    const { start } = useStartupSequence({
      bootstrap: async () => undefined,
      connect: async () => undefined,
      initialize: async () => undefined,
      connectTimeoutMs: 0,
    });
    await start();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("opens /error without tearing down the overlay when boot fails", async () => {
    const { start, visible, ready, failed } = useStartupSequence({
      bootstrap: async () => undefined,
      connect: async () => {
        throw new Error("凭证无效");
      },
      initialize: async () => undefined,
      connectTimeoutMs: 0,
    });
    await start();
    expect(ready.value).toBe(false);
    expect(failed.value).toBe(true);
    expect(visible.value).toBe(true);
    expect(useStartupError().value).toBe("请求失败。请检查本地服务后重试。");
    expect(replace).toHaveBeenCalledWith({ name: "error" });
  });

  it("treats a hung connect as a startup error", async () => {
    const { start, failed, visible } = useStartupSequence({
      bootstrap: async () => undefined,
      connect: () => new Promise(() => {}),
      initialize: async () => undefined,
      connectTimeoutMs: 20,
    });
    await start();
    expect(failed.value).toBe(true);
    expect(visible.value).toBe(true);
    expect(replace).toHaveBeenCalledWith({ name: "error" });
  });
});
