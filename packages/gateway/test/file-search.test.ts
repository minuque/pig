import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { searchFiles } from "../src/pi/file-search.js"

const root = await mkdtemp(join(tmpdir(), "pig-file-search-"))

await mkdir(join(root, "src/deep/nest"), { recursive: true })

await mkdir(join(root, "node_modules/pkg"), { recursive: true })

await writeFile(join(root, "src/app.ts"), "")

await writeFile(join(root, "src/deep/nest/file.md"), "")

await writeFile(join(root, "README.md"), "")

await writeFile(join(root, "node_modules/pkg/x.ts"), "")

afterAll(async () => {
  const { rm } = await import("node:fs/promises")
  await rm(root, { recursive: true, force: true })
})

describe("searchFiles", () => {
  it("按子序列匹配相对路径", async () => {
    const hits = await searchFiles(root, "appts")
    expect(hits.map((entry) => entry.path)).toContain("src/app.ts")
  })

  it("跳过依赖目录与过深节点", async () => {
    const hits = await searchFiles(root, "x.ts")
    expect(hits.map((entry) => entry.path)).not.toContain("node_modules/pkg/x.ts")
  })

  it("目录带尾斜杠，空查询返回顺序流", async () => {
    const hits = await searchFiles(root, "")
    expect(hits.some((entry) => entry.path === "src/" && entry.kind === "directory")).toBe(true)
  })

  it("不存在的目录返回空而不是抛错", async () => {
    await expect(searchFiles(join(root, "missing"), "a")).resolves.toEqual([])
  })
})
