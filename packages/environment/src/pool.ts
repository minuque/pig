import { LocalEnvironment } from "./local.js"
import { SshEnvironment } from "./ssh.js"
import type { Environment } from "./types.js"

/** 挂在 globalThis 上：gateway 原生加载与扩展经 jiti 加载是两份模块实例，也共用一条长连接。 */
const POOL = Symbol.for("pig.environment.pool")
const pool = ((globalThis as { [POOL]?: Map<string, Environment> })[POOL] ??= new Map())

/** 登记一个环境：测试与 e2e 用本机环境替身充当某台 SSH 主机。 */
export function registerEnvironment(id: string, env: Environment) {
  pool.set(id, env)
}

/** 按 id 取环境："local" 或 "ssh://<主机别名>"；同一 id 进程内只建一次。 */
export function environmentFor(id: string): Environment {
  const cached = pool.get(id)

  if (cached) return cached

  if (id !== "local" && !id.startsWith("ssh://")) throw new Error(`Unknown environment: ${id}`)
  const created = id === "local" ? new LocalEnvironment() : new SshEnvironment(id.slice(6))
  pool.set(id, created)
  return created
}
