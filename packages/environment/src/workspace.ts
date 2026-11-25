import { homedir } from "node:os"
import { join, resolve } from "node:path"

export function defaultPigHome(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PIG_HOME?.trim()
  return configured ? resolve(configured) : join(homedir(), ".pig")
}

export const defaultTaskLogRoot = () => join(defaultPigHome(), "tasks")
