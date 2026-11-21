import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { defaultPigHome } from "@pig/environment"

function authorizedWorkspacesFile(sessionDir?: string, pigHome?: string): string {
  if (sessionDir) return join(sessionDir, "authorized-workspaces.json")
  return join(pigHome ?? defaultPigHome(), "authorized-workspaces.json")
}

export async function loadAuthorizedWorkspaces(
  sessionDir?: string,
  pigHome?: string,
): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(authorizedWorkspacesFile(sessionDir, pigHome), "utf-8"),
    )

    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
  } catch {
    return []
  }
}

export async function saveAuthorizedWorkspaces(
  sessionDir: string | undefined,
  paths: Set<string>,
  pigHome?: string,
) {
  const file = authorizedWorkspacesFile(sessionDir, pigHome)

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify([...paths]), "utf-8")
}
