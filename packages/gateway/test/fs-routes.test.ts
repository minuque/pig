import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { LocalEnvironment } from "@pig/environment"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import Gateway from "../src/index.js"

let gateway: Gateway | undefined
let sessionDir: string
let workspace: string
let outside: string
let base: string

beforeEach(async () => {
  sessionDir = await mkdtemp(join(tmpdir(), "pig-fs-session-"))
  workspace = await mkdtemp(join(tmpdir(), "pig-fs-ws-"))
  outside = await mkdtemp(join(tmpdir(), "pig-fs-outside-"))
  await mkdir(join(workspace, "src"))
  await writeFile(join(workspace, "src", "main.ts"), "export const answer = 42\n")
  await writeFile(join(workspace, "logo.bin"), Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02, 0x03]))
  await writeFile(join(workspace, "big.txt"), "x".repeat(1024 * 1024 + 1))
  await writeFile(join(outside, "secret.txt"), "secret")
  gateway = new Gateway({
    platformPort: {
      selectDirectory: async () => workspace,
      validateDirectory: async (path) => path,
    },
    createRuntime: async () =>
      ({
        getAvailable: async () => [],
        hasConfiguredAuth: () => false,
        getModel: () => undefined,
      }) as never,
    sessionDir,
  })
  base = `http://127.0.0.1:${await gateway.start()}`
  await get("/api/v1/platform/select-directory", { method: "POST" })
})

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined

  for (const dir of [sessionDir, workspace, outside])
    await rm(dir, { recursive: true, force: true, maxRetries: 5 })
})

function get(path: string, init?: RequestInit & { headers?: Record<string, string> }) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: gateway?.authorizationHeader() ?? "", ...init?.headers },
  })
}

const fsUrl = (kind: string, path: string, cwd = workspace) =>
  `/api/v1/platform/fs/${kind}?${new URLSearchParams({ cwd, path }).toString()}`

describe("fs routes", () => {
  it("未授权的工作区一律 403", async () => {
    for (const kind of ["stat", "text", "raw"])
      expect((await get(fsUrl(kind, "secret.txt", outside))).status).toBe(403)
  })

  it("越出工作区根的路径 403", async () => {
    const escape = `../${outside.split(/[\\/]/).pop()}/secret.txt`

    for (const kind of ["stat", "text", "raw"])
      expect((await get(fsUrl(kind, escape))).status).toBe(403)
    expect((await get(fsUrl("text", join(outside, "secret.txt")))).status).toBe(403)
  })

  it("stat 返回类型与大小，不存在 404", async () => {
    const response = await get(fsUrl("stat", "src/main.ts"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ kind: "file", size: 25 })
    expect((await get(fsUrl("stat", "src/none.ts"))).status).toBe(404)
  })

  it("text 读出文本；二进制与超限只给分类", async () => {
    await expect((await get(fsUrl("text", "src/main.ts"))).json()).resolves.toEqual({
      content: "export const answer = 42\n",
      size: 25,
      binary: false,
      tooLarge: false,
    })
    await expect((await get(fsUrl("text", "logo.bin"))).json()).resolves.toEqual({
      size: 6,
      binary: true,
      tooLarge: false,
    })
    await expect((await get(fsUrl("text", "big.txt"))).json()).resolves.toEqual({
      size: 1024 * 1024 + 1,
      binary: false,
      tooLarge: true,
    })
  })

  it("text 带 force 时二进制也按文本读出", async () => {
    const body = (await (await get(`${fsUrl("text", "logo.bin")}&force=1`)).json()) as {
      content?: string
    }

    expect(typeof body.content).toBe("string")
  })

  it("raw 输出原始字节并支持 Range", async () => {
    const whole = await get(fsUrl("raw", "logo.bin"))

    expect(whole.status).toBe(200)
    expect(whole.headers.get("accept-ranges")).toBe("bytes")
    expect(Buffer.from(await whole.arrayBuffer())).toEqual(
      Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02, 0x03]),
    )

    const part = await get(fsUrl("raw", "logo.bin"), { headers: { range: "bytes=2-3" } })

    expect(part.status).toBe(206)
    expect(part.headers.get("content-range")).toBe("bytes 2-3/6")
    expect(Buffer.from(await part.arrayBuffer())).toEqual(Buffer.from([0x00, 0x01]))

    const open = await get(fsUrl("raw", "logo.bin"), { headers: { range: "bytes=4-" } })

    expect(open.status).toBe(206)
    expect(Buffer.from(await open.arrayBuffer())).toEqual(Buffer.from([0x02, 0x03]))
    expect((await get(fsUrl("raw", "logo.bin"), { headers: { range: "bytes=9-" } })).status).toBe(
      416,
    )
  })

  it("raw 默认禁止脚本，PDF 例外让浏览器自带的查看器能打开", async () => {
    await writeFile(join(workspace, "page.html"), "<script>1</script>")
    await writeFile(join(workspace, "doc.pdf"), "%PDF-1.4")

    expect((await get(fsUrl("raw", "page.html"))).headers.get("content-security-policy")).toBe(
      "sandbox",
    )
    const pdf = await get(fsUrl("raw", "doc.pdf"))

    expect(pdf.headers.get("content-type")).toBe("application/pdf")
    expect(pdf.headers.get("content-security-policy")).toBeNull()
  })

  it("raw 按扩展名给 Content-Type", async () => {
    await writeFile(join(workspace, "a.png"), Buffer.from([1]))

    expect((await get(fsUrl("raw", "a.png"))).headers.get("content-type")).toBe("image/png")
  })
})

// git 钩子里跑测试时会带上 GIT_DIR 等变量，不清掉的话 git 命令会落到真仓库上
for (const key of Object.keys(process.env)) if (key.startsWith("GIT_")) delete process.env[key]

describe("目录、git 状态与内容搜索", () => {
  async function gitWorkspace() {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: workspace, stdio: "pipe" })
    git("init", "-q")
    git("config", "user.email", "e2e@pig.local")
    git("config", "user.name", "pig")
    await writeFile(join(workspace, ".gitignore"), "dist/\n*.log\n")
    await mkdir(join(workspace, "dist"))
    await writeFile(join(workspace, "dist", "out.js"), "needle in build output\n")
    await writeFile(join(workspace, "debug.log"), "needle in log\n")
    await writeFile(join(workspace, "file10.ts"), "")
    await writeFile(join(workspace, "file9.ts"), "")
    git("add", ".gitignore", "src/main.ts", "file9.ts")
    git("commit", "-q", "-m", "init")
    await writeFile(
      join(workspace, "src", "main.ts"),
      "export const answer = 43\nconst needle = 1\n",
    )
  }

  it("list 目录在前、名字按自然序，gitignore 命中的打标记", async () => {
    await gitWorkspace()
    const response = await get(fsUrl("list", "."))

    expect(response.status).toBe(200)

    const { entries } = (await response.json()) as {
      entries: { name: string; kind: string; ignored: boolean }[]
    }

    expect(entries.map((entry) => entry.name)).toEqual([
      ".git",
      "dist",
      "src",
      ".gitignore",
      "big.txt",
      "debug.log",
      "file9.ts",
      "file10.ts",
      "logo.bin",
    ])
    expect(entries.find((entry) => entry.name === "dist")?.ignored).toBe(true)
    expect(entries.find((entry) => entry.name === "debug.log")?.ignored).toBe(true)
    expect(entries.find((entry) => entry.name === "src")?.ignored).toBe(false)
  })

  it("不是 git 仓库时 list 照常列出，都不标忽略", async () => {
    const { entries } = (await (await get(fsUrl("list", "src"))).json()) as {
      entries: { name: string; ignored: boolean }[]
    }

    expect(entries).toEqual([{ name: "main.ts", kind: "file", ignored: false }])
  })

  it("git status 报告修改与未跟踪的文件，路径相对工作区", async () => {
    await gitWorkspace()

    const body = (await (
      await get(`/api/v1/platform/git/status?cwd=${encodeURIComponent(workspace)}`)
    ).json()) as { repo: boolean; files: { path: string; status: string }[] }

    expect(body.repo).toBe(true)
    expect(body.files).toEqual(
      expect.arrayContaining([
        { path: "src/main.ts", status: "M" },
        { path: "file10.ts", status: "U" },
      ]),
    )
    expect(body.files.some((file) => file.path.startsWith("dist/"))).toBe(false)
  })

  it("git status 在非仓库返回 repo false", async () => {
    await expect(
      (await get(`/api/v1/platform/git/status?cwd=${encodeURIComponent(workspace)}`)).json(),
    ).resolves.toEqual({ repo: false, files: [] })
  })

  it("内容搜索给出路径、行号与那一行，跳过 gitignore 命中的文件", async () => {
    await gitWorkspace()

    const body = (await (
      await get(
        `/api/v1/platform/fs/search?${new URLSearchParams({ cwd: workspace, q: "NEEDLE" }).toString()}`,
      )
    ).json()) as { matches: { path: string; line: number; text: string }[] }

    expect(body.matches).toEqual([{ path: "src/main.ts", line: 2, text: "const needle = 1" }])
  })

  it("内容搜索截断时说明原因：命中条数到上限、跳过过大的文件", async () => {
    await writeFile(join(workspace, "many.txt"), "hit\n".repeat(300))
    await writeFile(join(workspace, "huge.txt"), `hit${"x".repeat(2 * 1024 * 1024)}`)

    const body = (await (
      await get(
        `/api/v1/platform/fs/search?${new URLSearchParams({ cwd: workspace, q: "hit" }).toString()}`,
      )
    ).json()) as { matches: unknown[]; truncated: boolean; truncationReasons: string[] }

    expect(body.matches).toHaveLength(241)
    expect(body.truncated).toBe(true)
    expect(body.truncationReasons).toEqual(
      expect.arrayContaining(["result-limit", "content-file-limit"]),
    )
  })

  it("内容搜索没截断时原因为空", async () => {
    const body = (await (
      await get(
        `/api/v1/platform/fs/search?${new URLSearchParams({ cwd: workspace, q: "answer" }).toString()}`,
      )
    ).json()) as { truncated: boolean; truncationReasons: string[] }

    expect(body).toMatchObject({ truncated: false, truncationReasons: [] })
  })

  it("未授权的工作区 list、status、search 都 403", async () => {
    const cwd = encodeURIComponent(outside)

    expect((await get(fsUrl("list", ".", outside))).status).toBe(403)
    expect((await get(`/api/v1/platform/git/status?cwd=${cwd}`)).status).toBe(403)
    expect((await get(`/api/v1/platform/fs/search?cwd=${cwd}&q=x`)).status).toBe(403)
  })
})

describe("HTML 预览的令牌地址", () => {
  async function token(cwd = workspace) {
    const response = await get(
      `/api/v1/platform/fs/preview-token?${new URLSearchParams({ cwd }).toString()}`,
    )
    return { status: response.status, token: ((await response.json()) as { token?: string }).token }
  }

  it("只给授权过的工作区发令牌", async () => {
    expect((await token(outside)).status).toBe(403)
    expect((await token()).token).toMatch(/^[\w-]{20,}$/)
  })

  it("不带 cookie 也能凭令牌取页面与同目录的资源，响应禁同源并且不外泄地址", async () => {
    await mkdir(join(workspace, "site"))
    await writeFile(
      join(workspace, "site", "index.html"),
      "<html><head></head><body>hi</body></html>",
    )
    await writeFile(join(workspace, "site", "app.js"), "console.log(1)")
    const { token: value } = await token()
    const page = await fetch(`${base}/api/v1/preview/${value}/site/index.html`)

    expect(page.status).toBe(200)
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(page.headers.get("content-security-policy")).toBe("sandbox allow-scripts")
    expect(page.headers.get("referrer-policy")).toBe("no-referrer")
    // 注入的脚本把外链交给外层确认
    expect(await page.text()).toContain("pig-preview-link")

    const asset = await fetch(`${base}/api/v1/preview/${value}/site/app.js`)

    expect(asset.status).toBe(200)
    expect(await asset.text()).toBe("console.log(1)")
  })

  it("令牌不对或路径越界都拒绝", async () => {
    const { token: value } = await token()

    expect((await fetch(`${base}/api/v1/preview/nope/src/main.ts`)).status).toBe(403)
    expect((await fetch(`${base}/api/v1/preview/${value}/..%2F..%2Fsecret.txt`)).status).toBe(403)
  })
})

describe("preview 的边界情况", () => {
  async function previewToken() {
    const response = await get(
      `/api/v1/platform/fs/preview-token?${new URLSearchParams({ cwd: workspace }).toString()}`,
    )
    return ((await response.json()) as { token: string }).token
  }

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("读文件出错时回 500，gateway 照常服务", async () => {
    const value = await previewToken()
    vi.spyOn(LocalEnvironment.prototype, "readStream").mockRejectedValueOnce(
      Object.assign(new Error("busy"), { code: "EBUSY" }),
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    expect((await fetch(`${base}/api/v1/preview/${value}/src/main.ts`)).status).toBe(500)
    expect((await get("/health")).status).toBe(200)
  })

  it("页面引用的音视频等资源按 Range 分段给出", async () => {
    await writeFile(join(workspace, "clip.mp4"), Buffer.from("0123456789"))
    const value = await previewToken()
    const part = await fetch(`${base}/api/v1/preview/${value}/clip.mp4`, {
      headers: { range: "bytes=2-5" },
    })

    expect(part.status).toBe(206)
    expect(part.headers.get("content-range")).toBe("bytes 2-5/10")
    expect(await part.text()).toBe("2345")
  })

  it("预览一直在用，令牌就不过期；闲置超过一小时才失效", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const value = await previewToken()
    const asset = () => fetch(`${base}/api/v1/preview/${value}/src/main.ts`)

    vi.advanceTimersByTime(50 * 60 * 1000)
    expect((await asset()).status).toBe(200)
    vi.advanceTimersByTime(50 * 60 * 1000)
    expect((await asset()).status).toBe(200)
    vi.advanceTimersByTime(61 * 60 * 1000)
    expect((await asset()).status).toBe(403)
  })
})
