import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn(async () => undefined);
const currentRoute = { value: { name: undefined as string | undefined } };

vi.mock("vue-router", () => ({
  useRouter: () => ({ currentRoute, replace }),
}));

import {
  setStartupError,
  useStartupError,
} from "@features/startup-wait/hooks/use-startup-error.js";
import { useStartupSequence } from "@features/startup-wait/hooks/use-startup-sequence.js";

describe("startup sequence", () => {
  beforeEach(() => {
    setStartupError("");
    currentRoute.value = { name: undefined };
    replace.mockClear();
  });

  it("runs bootstrap, connect, then initialize", async () => {
    const order: string[] = [];
    const { start, ready, phase, visible } = useStartupSequence({
      bootstrap: async () => {
        order.push("bootstrap");
      },
      connect: async () => {
        order.push("connect");
      },
      initialize: async () => {
        order.push("initialize");
      },
    });
    await start();
    expect(order).toEqual(["bootstrap", "connect", "initialize"]);
    expect(ready.value).toBe(true);
    expect(phase.value).toBe("preparing");
    expect(visible.value).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves the error route after a successful boot", async () => {
    currentRoute.value = { name: "error" };
    const { start } = useStartupSequence({
      bootstrap: async () => undefined,
      connect: async () => undefined,
      initialize: async () => undefined,
    });
    await start();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("opens /error and hides the overlay when boot fails", async () => {
    const { start, visible, ready, failed } = useStartupSequence({
      bootstrap: async () => undefined,
      connect: async () => {
        throw new Error("凭证无效");
      },
      initialize: async () => undefined,
    });
    await start();
    expect(ready.value).toBe(false);
    expect(failed.value).toBe(true);
    expect(visible.value).toBe(false);
    expect(useStartupError().value).toBe("请求失败。请检查本地服务后重试。");
    expect(replace).toHaveBeenCalledWith({ name: "error" });
  });
});
