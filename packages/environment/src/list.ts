import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { readSshConfig, sshHosts } from "./ssh-config.js"

import type { EnvironmentInfo } from "@pig/protocol"

export type { EnvironmentInfo }

type SavedEnvironment = { host: string; path?: string }

export const defaultEnvironmentsPath = () => join(homedir(), ".pig", "environments.json")

async function readSaved(path: string): Promise<SavedEnvironment[]> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8").catch(() => "[]"))

  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: Partial<SavedEnvironment>): SavedEnvironment[] =>
    item && typeof item.host === "string" && item.host
      ? [{ host: item.host, ...(typeof item.path === "string" ? { path: item.path } : {}) }]
      : [],
  )
}

/** 本机在前，再是 pig 保存的环境，最后是 ~/.ssh/config 里其余的主机。 */
export async function listEnvironments(
  options: { sshConfigPath?: string; savedPath?: string } = {},
): Promise<EnvironmentInfo[]> {
  const [config, saved] = await Promise.all([
    readSshConfig(options.sshConfigPath),
    readSaved(options.savedPath ?? defaultEnvironmentsPath()).catch(() => []),
  ])
  const savedHosts = new Set(saved.map((item) => item.host))
  return [
    { id: "local", kind: "local", saved: false },
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
