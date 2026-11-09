import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

/** 用户选过的目录清单；与会话目录同级，跨重启保留。 */
function authorizedWorkspacesFile(sessionDir?: string): string {
  if (sessionDir) return join(sessionDir, "authorized-workspaces.json")
  return join(homedir(), ".pig", "authorized-workspaces.json")
}

/** 读授权目录清单：文件缺失/损坏一律当空集，不拦启动。 */
export async function loadAuthorizedWorkspaces(sessionDir?: string): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(authorizedWorkspacesFile(sessionDir), "utf-8"),
    )

    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
  } catch {
    return []
  }
}

export async function saveAuthorizedWorkspaces(sessionDir: string | undefined, paths: Set<string>) {
  const file = authorizedWorkspacesFile(sessionDir)

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify([...paths]), "utf-8")
}
