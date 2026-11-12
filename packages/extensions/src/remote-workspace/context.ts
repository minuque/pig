import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, posix } from "node:path"

import type { Environment } from "@pig/environment/source"

const CONTEXT_NAMES = ["AGENTS.md", "CLAUDE.md"]
const SKILL_DIRS = [".pi/skills", ".agents/skills"]
const MAX_SKILL_FILE = 1024 * 1024

/** 远端从根到 workspace 的每一级里，第一个存在的 AGENTS.md 或 CLAUDE.md；顺序与 pi 本地一致，外层在前。 */
export async function readRemoteContext(env: Environment, root: string) {
  const levels: string[] = []

  for (let dir = root; ; dir = posix.dirname(dir)) {
    levels.unshift(dir)

    if (dir === posix.dirname(dir)) break
  }

  const files: Array<{ path: string; content: string }> = []

  for (const dir of levels) {
    for (const name of CONTEXT_NAMES) {
      const path = posix.join(dir, name)
      const content = await env.readFile(path).catch(() => undefined)

      if (content) {
        files.push({ path, content: content.toString("utf8") })
        break
      }
    }
  }

  return files
}

/** 把远端项目 skills 拷到本地缓存目录，返回 pi 能加载的目录；远端没有 skills 返回空。 */
export async function syncRemoteSkills(env: Environment, root: string, cacheDir: string) {
  await rm(cacheDir, { recursive: true, force: true })
  const synced: string[] = []

  for (const [index, rel] of SKILL_DIRS.entries()) {
    const remoteDir = posix.join(root, rel)
    const entries = await env.search(remoteDir, "", { limit: 2000 }).catch(() => [])
    const files = entries.filter((entry) => entry.kind === "file")

    if (!files.length) continue
    const localDir = join(cacheDir, String(index))

    for (const file of files) {
      const remote = posix.join(remoteDir, file.path)
      const stat = await env.stat(remote)

      if (!stat || stat.size > MAX_SKILL_FILE) continue
      const target = join(localDir, ...file.path.split("/"))
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, await env.readFile(remote))
    }

    synced.push(localDir)
  }

  return synced
}
