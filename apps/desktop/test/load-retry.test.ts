import { describe, expect, it } from "vitest"

import { loadWithRetry } from "../src/main/load-retry.js"

describe("loadWithRetry", () => {
  it("瞬时错误重试一次后成功", async () => {
    let calls = 0

    await loadWithRetry(
      async () => {
        calls += 1

        if (calls < 2) throw new Error("ERR_FAILED (-2) loading 'http://127.0.0.1:5555/'")
      },
      { attempts: 3, delayMs: 0 },
    )

    expect(calls).toBe(2)
  })

  it("非瞬时错误不重试", async () => {
    let calls = 0

    await expect(
      loadWithRetry(
        async () => {
          calls += 1
          throw new Error("ERR_FILE_NOT_FOUND (-6) loading 'pig://app/'")
        },
        { attempts: 3, delayMs: 0 },
      ),
    ).rejects.toThrow("ERR_FILE_NOT_FOUND")

    expect(calls).toBe(1)
  })

  it("重试用尽抛出最后一次错误", async () => {
    let calls = 0

    await expect(
      loadWithRetry(
        async () => {
          calls += 1
          throw new Error("ERR_CONNECTION_REFUSED (-102)")
        },
        { attempts: 3, delayMs: 0 },
      ),
    ).rejects.toThrow("ERR_CONNECTION_REFUSED")

    expect(calls).toBe(3)
  })
})
