import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapFromUrl, persistCredential, restoreCredential } from "@client/http.js";

const store = new Map<string, string>();

function setHash(hash: string) {
  vi.stubGlobal("location", {
    hash,
    pathname: "/",
    search: "",
  });
}

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  });
  vi.stubGlobal("history", {
    replaceState: vi.fn((_state: unknown, _title: string, url: string) => {
      setHash(url.includes("#") ? url.slice(url.indexOf("#")) : "");
    }),
  });
  setHash("");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bootstrapFromUrl", () => {
  it("兑换成功后写入凭证并清掉 hash", async () => {
    setHash("#bootstrap=once");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ credential: "cred-1" }),
      })),
    );

    await bootstrapFromUrl();

    expect(restoreCredential()).toBe("cred-1");
    expect(location.hash).toBe("");
  });

  it("刷新后 hash 仍带已用过的 secret 时，保留已有凭证且不抛 INVALID_BOOTSTRAP", async () => {
    persistCredential("cred-1");
    setHash("#bootstrap=once");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ code: "INVALID_BOOTSTRAP" }),
      })),
    );

    await expect(bootstrapFromUrl()).resolves.toBeUndefined();

    expect(restoreCredential()).toBe("cred-1");
    expect(location.hash).toBe("");
  });

  it("没有已存凭证时兑换失败仍抛 INVALID_BOOTSTRAP", async () => {
    setHash("#bootstrap=once");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ code: "INVALID_BOOTSTRAP" }),
      })),
    );

    await expect(bootstrapFromUrl()).rejects.toMatchObject({ code: "INVALID_BOOTSTRAP" });
  });
});
