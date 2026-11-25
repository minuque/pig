import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, expect, test } from "vitest"

import { LocalEnvironment } from "../src/index.js"

let root: string
const local = new LocalEnvironment()

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pig-env-"))
})

afterEach(() => rm(root, { recursive: true, force: true }))

test("本机环境：写进去的文件能读回，命令输出与退出码照实返回", async () => {
  const file = join(root, "a", "b.txt")
  await local.mkdir(join(root, "a"))
  await local.writeFile(file, "你好")
  expect((await local.readFile(file)).toString()).toBe("你好")
  expect(await local.stat(join(root, "nope"))).toBeUndefined()

  const chunks: Buffer[] = []
  const result = await local.exec("cat a/b.txt; exit 3", {
    cwd: root,
    onData: (data) => chunks.push(data),
  })

  expect(Buffer.concat(chunks).toString()).toBe("你好")
  expect(result.exitCode).toBe(3)
})

test("搜索：跳过 node_modules、.git 这类目录，.pi 保留，按匹配排序", async () => {
  await mkdir(join(root, "src", "deep"), { recursive: true })
  await mkdir(join(root, "node_modules", "lib"), { recursive: true })
  await mkdir(join(root, ".git"))
  await mkdir(join(root, ".pi"))
  await writeFile(join(root, "src", "deep", "main.ts"), "")
  await writeFile(join(root, "node_modules", "lib", "index.js"), "")
  await writeFile(join(root, ".pi", "settings.json"), "")

  const paths = (await local.search(root, "")).map((entry) => entry.path).sort()
  expect(paths).toEqual([
    ".pi/",
    ".pi/settings.json",
    "node_modules/",
    "src/",
    "src/deep/",
    "src/deep/main.ts",
  ])
  expect((await local.search(root, "main"))[0]?.path).toBe("src/deep/main.ts")
})
