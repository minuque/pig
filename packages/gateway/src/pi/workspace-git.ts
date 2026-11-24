import path from "node:path"
import type { Environment } from "@pig/environment"
import type { WorkspaceGit } from "@pig/protocol"
import { workspaceEnvironment } from "./remote-session.js"

type GitReader = Pick<Environment, "stat" | "readFile">

async function findGitDir(
  env: GitReader,
  paths: path.PlatformPath,
  root: string,
): Promise<{ gitDir: string; worktree: boolean } | undefined> {
  for (let dir = root; ;) {
    const dotGit = paths.join(dir, ".git")
    const stat = await env.stat(dotGit)

    if (stat?.kind === "directory") return { gitDir: dotGit, worktree: false }

    if (stat?.kind === "file") {
      const pointer = /^gitdir:\s*(.+)$/m.exec((await env.readFile(dotGit)).toString("utf8"))

      if (!pointer?.[1]) return undefined
      const gitDir = paths.resolve(dir, pointer[1].trim())
      return { gitDir, worktree: /[\\/]worktrees[\\/][^\\/]+$/.test(gitDir) }
    }

    const parent = paths.dirname(dir)

    if (parent === dir) return undefined
    dir = parent
  }
}

export async function readGit(
  env: GitReader,
  paths: path.PlatformPath,
  root: string,
): Promise<WorkspaceGit | undefined> {
  const found = await findGitDir(env, paths, root)

  if (!found) return undefined
  const head = (await env.readFile(paths.join(found.gitDir, "HEAD"))).toString("utf8").trim()
  const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)

  if (ref?.[1]) return { branch: ref[1], detached: false, worktree: found.worktree }
  return /^[0-9a-f]{7,}$/i.test(head)
    ? { branch: head.slice(0, 7), detached: true, worktree: found.worktree }
    : undefined
}

export async function readWorkspaceGit(workspace: string): Promise<WorkspaceGit | undefined> {
  const { env, root } = workspaceEnvironment(workspace)
  return readGit(env, env.id === "local" ? path : path.posix, root)
}
