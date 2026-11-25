import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { WorkspaceGit } from "@pig/protocol"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WorkspaceGitStore } from "../src/pi/workspace-git-store.js"

type Changes = Record<string, WorkspaceGit | null>

let base: string
let file: string
const stores: WorkspaceGitStore[] = []

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), "pig-git-store-"))
  file = path.join(base, "pig-home", "workspace-git.json")
})

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()))
  await rm(base, { recursive: true, force: true, maxRetries: 5 })
})

function store(): WorkspaceGitStore {
  const created = new WorkspaceGitStore(file, { debounceMs: 20, writeDelayMs: 20 })
  stores.push(created)
  return created
}

async function repo(dir: string, branch: string): Promise<void> {
  await mkdir(path.join(dir, ".git"), { recursive: true })
  await writeFile(path.join(dir, ".git", "HEAD"), `ref: refs/heads/${branch}\n`)
}

async function checkout(dir: string, branch: string): Promise<void> {
  const temp = path.join(dir, ".git", "HEAD.lock")
  await writeFile(temp, `ref: refs/heads/${branch}\n`)
  await rename(temp, path.join(dir, ".git", "HEAD"))
}

function collect(target: WorkspaceGitStore): Changes[] {
  const seen: Changes[] = []
  target.onChange((changes) => seen.push(changes))
  return seen
}

const branch = (name: string): WorkspaceGit => ({ branch: name, detached: false, worktree: false })

describe("WorkspaceGitStore", () => {
  it("track 读出分支；终端里切分支后推一次变化", async () => {
    const dir = path.join(base, "app")
    await repo(dir, "main")
    const git = store()
    const seen = collect(git)

    await git.track([dir])
    expect(git.snapshot()).toEqual({ [dir]: branch("main") })

    await checkout(dir, "feat/sidebar")
    await vi.waitFor(() => expect(seen.at(-1)).toEqual({ [dir]: branch("feat/sidebar") }))
    expect(git.snapshot()[dir]).toEqual(branch("feat/sidebar"))
  })

  it("同一仓库的两个子目录共用监听，一次切换两个都更新", async () => {
    const dir = path.join(base, "app")
    const ui = path.join(dir, "packages", "ui")
    const web = path.join(dir, "apps", "web")
    await repo(dir, "main")
    await mkdir(ui, { recursive: true })
    await mkdir(web, { recursive: true })
    const git = store()
    const seen = collect(git)

    await git.track([ui, web])
    await checkout(dir, "next")

    await vi.waitFor(() =>
      expect(Object.assign({}, ...seen)).toEqual({ [ui]: branch("next"), [web]: branch("next") }),
    )
  })

  it("删掉 .git 后推 null", async () => {
    const dir = path.join(base, "app")
    await repo(dir, "main")
    const git = store()
    const seen = collect(git)

    await git.track([dir])
    await rm(path.join(dir, ".git"), { recursive: true, force: true })
    await git.refresh([dir])

    expect(seen.at(-1)).toEqual({ [dir]: null })
    expect(git.snapshot()).toEqual({})
  })

  it("还不是仓库的目录 git init 后，下一次 refresh 补上分支", async () => {
    const dir = path.join(base, "plain")
    await mkdir(dir, { recursive: true })
    const git = store()
    await git.track([dir])
    const seen = collect(git)

    await repo(dir, "main")
    await git.refresh()

    expect(seen).toEqual([{ [dir]: branch("main") }])
  })

  it("track 去掉的目录不再推变化，也移出快照", async () => {
    const dir = path.join(base, "app")
    await repo(dir, "main")
    const git = store()
    await git.track([dir])
    const seen = collect(git)

    await git.track([])
    await checkout(dir, "later")
    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(seen).toEqual([])
    expect(git.snapshot()).toEqual({})
  })

  it("重启后 load 立刻给出上次的分支；关闭期间切过的，track 后更正", async () => {
    const kept = path.join(base, "kept")
    const moved = path.join(base, "moved")
    await repo(kept, "main")
    await repo(moved, "main")
    const first = store()
    await first.track([kept, moved])
    await first.close()

    await checkout(moved, "feat/after")
    const second = store()
    const seen = collect(second)
    await second.load()

    expect(second.snapshot()).toEqual({ [kept]: branch("main"), [moved]: branch("main") })

    await second.track([kept, moved])
    expect(seen).toEqual([{ [moved]: branch("feat/after") }])
  })

  it("落盘文件损坏时 load 当成空缓存，之后照常覆盖", async () => {
    const dir = path.join(base, "app")
    await repo(dir, "main")
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, "{ not json")
    const git = store()

    await git.load()
    expect(git.snapshot()).toEqual({})

    await git.track([dir])
    await git.close()
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({
      version: 1,
      workspaces: { [dir]: branch("main") },
    })
  })
})
