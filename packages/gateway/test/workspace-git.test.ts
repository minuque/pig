import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { LocalEnvironment } from "@pig/environment"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { readGit } from "../src/pi/workspace-git.js"

const env = new LocalEnvironment()
let base: string

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "pig-git-"))
})

afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

async function repo(dir: string, head: string): Promise<void> {
  await mkdir(path.join(dir, ".git"), { recursive: true })
  await writeFile(path.join(dir, ".git", "HEAD"), `${head}\n`)
}

describe("readGit", () => {
  it("从子目录向上找到仓库并读出当前分支", async () => {
    const root = path.join(base, "app")
    await repo(root, "ref: refs/heads/feat/sidebar")
    await mkdir(path.join(root, "packages", "ui"), { recursive: true })

    expect(await readGit(env, path, path.join(root, "packages", "ui"))).toEqual({
      branch: "feat/sidebar",
      detached: false,
      worktree: false,
    })
  })

  it("linked worktree 读它自己的 HEAD，并标为 worktree", async () => {
    const main = path.join(base, "app")
    const linked = path.join(base, "app-review")
    const gitDir = path.join(main, ".git", "worktrees", "app-review")
    await repo(main, "ref: refs/heads/main")
    await mkdir(gitDir, { recursive: true })
    await writeFile(path.join(gitDir, "HEAD"), "ref: refs/heads/review/pr-106\n")
    await mkdir(linked)
    await writeFile(path.join(linked, ".git"), `gitdir: ${gitDir}\n`)

    expect(await readGit(env, path, linked)).toEqual({
      branch: "review/pr-106",
      detached: false,
      worktree: true,
    })
  })

  it("分离 HEAD 时给出短 hash", async () => {
    const root = path.join(base, "app")
    await repo(root, "3f9c2a17b6d04e8f9a1c5b7e2d3f4a6b8c9d0e1f")

    expect(await readGit(env, path, root)).toEqual({
      branch: "3f9c2a1",
      detached: true,
      worktree: false,
    })
  })

  it("不在仓库里时没有 git 信息", async () => {
    const plain = path.join(base, "notes")
    await mkdir(plain)

    expect(await readGit(env, path, plain)).toBeUndefined()
  })
})
