import { readFile } from "node:fs/promises"
import { hostname } from "node:os"
import { join } from "node:path"

import { readSshConfig, sshHosts } from "./ssh-config.js"
import { defaultPigHome } from "./workspace.js"

export interface EnvironmentInfo {
  id: string
  kind: "local" | "ssh"
  host?: string
  defaultPath?: string
  saved: boolean
}

type SavedEnvironment = { host: string; path?: string }

export const defaultEnvironmentsPath = () => join(defaultPigHome(), "environments.json")

async function readSaved(path: string): Promise<SavedEnvironment[]> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8").catch(() => "[]"))

  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: Partial<SavedEnvironment>): SavedEnvironment[] =>
    item && typeof item.host === "string" && item.host
      ? [{ host: item.host, ...(typeof item.path === "string" ? { path: item.path } : {}) }]
      : [],
  )
}

export async function listEnvironments(
  options: { sshConfigPath?: string; savedPath?: string } = {},
): Promise<EnvironmentInfo[]> {
  const [config, saved] = await Promise.all([
    readSshConfig(options.sshConfigPath),
    readSaved(options.savedPath ?? defaultEnvironmentsPath()).catch(() => []),
  ])
  const savedHosts = new Set(saved.map((item) => item.host))
  return [
    { id: "local", kind: "local", host: hostname(), saved: false },
    ...saved.map((item): EnvironmentInfo => ({
      id: `ssh://${item.host}`,
      kind: "ssh",
      host: item.host,
      ...(item.path ? { defaultPath: item.path } : {}),
      saved: true,
    })),
    ...sshHosts(config)
      .filter((host) => !savedHosts.has(host))
      .map((host): EnvironmentInfo => ({ id: `ssh://${host}`, kind: "ssh", host, saved: false })),
  ]
}
