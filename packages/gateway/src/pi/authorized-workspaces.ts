import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { pigHomeFile } from "../system/pig-file.js"

function authorizedWorkspacesFile(sessionDir?: string, pigHome?: string): string {
  return pigHomeFile("authorized-workspaces.json", sessionDir, pigHome)
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
