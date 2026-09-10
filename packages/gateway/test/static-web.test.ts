import { mkdtemp, rm, writeFile } from "fs/promises"
import { get } from "http"
import { tmpdir } from "os"
import { basename, join } from "path"
import { gunzipSync } from "zlib"

import { afterEach, describe, expect, it } from "vitest"

import Gateway from "../src/index.js"

function getRaw(url: string, acceptEncoding: string) {
  return new Promise<{ encoding: string | undefined; body: Buffer }>((resolve, reject) => {
    get(url, { headers: { "accept-encoding": acceptEncoding } }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk) => chunks.push(chunk as Buffer))
      res.on("end", () =>
        resolve({
          encoding:
            typeof res.headers["content-encoding"] === "string"
              ? res.headers["content-encoding"]
              : undefined,
          body: Buffer.concat(chunks),
        }),
      )
    }).on("error", reject)
  })
}

let gateway: Gateway | undefined
let root: string | undefined
let outside: string | undefined

afterEach(async () => {
  await gateway?.stop()
  if (root) await rm(root, { recursive: true, force: true })
  if (outside) await rm(outside, { force: true })
})

describe("production web server", () => {
  it("serves assets and falls back to the SPA without exposing other files", async () => {
    root = await mkdtemp(join(tmpdir(), "gateway-web-"))
    await writeFile(join(root, "index.html"), "<main>app</main>")
    await writeFile(join(root, "app.js"), "console.log('app')")
    outside = `${root}.txt`
    await writeFile(outside, "secret")

    gateway = new Gateway({
      webRoot: root,
      sessionDir: root,
      createRuntime: async () =>
        ({
          getAvailable: async () => [],
          hasConfiguredAuth: () => false,
          getModel: () => undefined,
        }) as never,
    })
    const origin = `http://127.0.0.1:${await gateway.start()}`

    expect(await (await fetch(origin)).text()).toBe("<main>app</main>")
    expect(await (await fetch(`${origin}/sessions/one`)).text()).toBe("<main>app</main>")
    expect((await fetch(`${origin}/app.js`)).headers.get("content-type")).toContain("javascript")
    expect((await fetch(`${origin}/missing.js`)).status).toBe(404)
    expect(
      (await fetch(`${origin}/%2e%2e%2f${encodeURIComponent(basename(outside))}`)).status,
    ).toBe(404)
  })

  it("gzips compressible assets when the client accepts gzip", async () => {
    root = await mkdtemp(join(tmpdir(), "gateway-web-gzip-"))
    const script = `console.log(${JSON.stringify("x".repeat(800))});\n`
    await writeFile(join(root, "index.html"), "<main>app</main>")
    await writeFile(join(root, "chunk.js"), script)
    await writeFile(join(root, "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))

    gateway = new Gateway({
      webRoot: root,
      sessionDir: root,
      createRuntime: async () =>
        ({
          getAvailable: async () => [],
          hasConfiguredAuth: () => false,
          getModel: () => undefined,
        }) as never,
    })
    const origin = `http://127.0.0.1:${await gateway.start()}`

    const gzipped = await getRaw(`${origin}/chunk.js`, "gzip")
    expect(gzipped.encoding).toBe("gzip")
    expect(gunzipSync(gzipped.body).toString()).toBe(script)

    const identity = await getRaw(`${origin}/chunk.js`, "identity")
    expect(identity.encoding).toBeUndefined()
    expect(identity.body.toString()).toBe(script)

    const png = await getRaw(`${origin}/logo.png`, "gzip")
    expect(png.encoding).toBeUndefined()
    expect(png.body.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe(true)
  })
})
