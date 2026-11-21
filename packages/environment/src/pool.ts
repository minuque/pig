import { LocalEnvironment } from "./local.js"
import { SshEnvironment } from "./ssh.js"
import type { Environment } from "./types.js"

// 外部：gateway 原生加载与扩展经 jiti 加载是两份模块实例，池挂 globalThis 才能共用一条长连接
const POOL = Symbol.for("pig.environment.pool")
const pool = ((globalThis as { [POOL]?: Map<string, Environment> })[POOL] ??= new Map())

export function registerEnvironment(id: string, env: Environment) {
  pool.set(id, env)
}

export async function closeEnvironments() {
  await Promise.allSettled([...pool.values()].map((env) => env.close()))
}

export function environmentFor(id: string): Environment {
  const cached = pool.get(id)

  if (cached) return cached

  if (id !== "local" && !id.startsWith("ssh://")) throw new Error(`Unknown environment: ${id}`)
  const created = id === "local" ? new LocalEnvironment() : new SshEnvironment(id.slice(6))
  pool.set(id, created)
  return created
}
