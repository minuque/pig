import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, expect, test } from "vitest"

import { LocalEnvironment, connectConfig, listEnvironments, readSshConfig } from "../src/index.js"
import { FIND_COMMAND, parseFindOutput } from "../src/ssh.js"

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

test("搜索：远端 find 与本机遍历给出同一批候选", async () => {
  await mkdir(join(root, "src", "deep"), { recursive: true })
  await mkdir(join(root, "node_modules", "lib"), { recursive: true })
  await mkdir(join(root, ".git"))
  await mkdir(join(root, ".pi"))
  await writeFile(join(root, "src", "deep", "main.ts"), "")
  await writeFile(join(root, "node_modules", "lib", "index.js"), "")
  await writeFile(join(root, ".pi", "settings.json"), "")

  const walked = await local.search(root, "")
  const chunks: Buffer[] = []
  await local.exec(FIND_COMMAND, { cwd: root, onData: (data) => chunks.push(data) })
  const found = parseFindOutput(Buffer.concat(chunks).toString())
  const paths = walked.map((entry) => entry.path).sort()
  expect(paths).toEqual([
    ".pi/",
    ".pi/settings.json",
    "node_modules/",
    "src/",
    "src/deep/",
    "src/deep/main.ts",
  ])
  expect(found.map((entry) => entry.path).sort()).toEqual(paths)
  expect((await local.search(root, "main"))[0]?.path).toBe("src/deep/main.ts")
})

test("环境列表：本机在前，保存的环境带默认目录，ssh config 里的通配主机不列", async () => {
  const sshConfigPath = join(root, "config")
  const savedPath = join(root, "environments.json")
  await writeFile(
    sshConfigPath,
    [
      "Host devbox gpu",
      "  HostName 10.0.0.2",
      "  User ada",
      "  Port 2222",
      "Host *",
      "  User me",
    ].join("\n"),
  )
  await writeFile(savedPath, JSON.stringify([{ host: "gpu", path: "/srv/train" }]))

  expect(await listEnvironments({ sshConfigPath, savedPath })).toEqual([
    { id: "local", kind: "local", saved: false },
    { id: "ssh://gpu", kind: "ssh", host: "gpu", defaultPath: "/srv/train", saved: true },
    { id: "ssh://devbox", kind: "ssh", host: "devbox", saved: false },
  ])

  const config = await connectConfig("devbox", await readSshConfig(sshConfigPath))
  expect(config).toMatchObject({ host: "10.0.0.2", port: 2222, username: "ada" })
})
