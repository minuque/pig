import type { IncomingMessage } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { BrowserSession } from "../src/auth/browser-session.js"

const headers = (extra: IncomingMessage["headers"] = {}): IncomingMessage["headers"] => ({
  host: "127.0.0.1:4499",
  ...extra,
})

describe("BrowserSession.rejection", () => {
  const session = new BrowserSession(join(tmpdir(), "pig-unused-browser-session"))

  it("桌面外壳的 origin（pig://app）没有 Bearer 得 403", () => {
    expect(session.rejection(headers({ origin: "pig://app" }))).toBe(403)
  })

  it("同一 origin 带 Bearer 放行", () => {
    const authorization = session.authorizationHeader()
    expect(session.rejection(headers({ origin: "pig://app", authorization }))).toBeUndefined()
  })
})
