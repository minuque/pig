import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

/** 会话绑定的远程 workspace：环境 id 加该环境里的绝对目录。 */
export interface RemoteBinding {
  environment: string
  path: string
}

/** 会话文件里记绑定的自定义条目类型。 */
export const BINDING_ENTRY = "pig.remote"
export const defaultRemoteRoot = () => join(homedir(), ".pig", "remote")
/** 后台任务日志的根目录：<根>/<会话 id>/<任务 id>.log。 */
export const defaultTaskLogRoot = () => join(homedir(), ".pig", "tasks")
/** 侧栏与会话索引用的 workspace 键，如 ssh://devbox/srv/app。 */
export const remoteWorkspaceKey = (binding: RemoteBinding) =>
  `${binding.environment}${binding.path.startsWith("/") ? "" : "/"}${binding.path}`

/** ssh://主机/路径 拆成绑定；不是远程键返回 undefined。 */
export function parseRemoteKey(key: string): RemoteBinding | undefined {
  const match = /^ssh:\/\/([^/]+)(\/.*)?$/.exec(key)
  return match?.[1] ? { environment: `ssh://${match[1]}`, path: match[2] || "/" } : undefined
}

/** 本地占位目录：同一远程 workspace 的会话落到同一个目录，目录名取路径哈希避免冲突。 */
export function remoteCwd(binding: RemoteBinding, root = defaultRemoteRoot()): string {
  const host = binding.environment.replace(/^ssh:\/\//, "").replace(/[^\w.-]/g, "_")
  return join(root, host, createHash("sha256").update(binding.path).digest("hex").slice(0, 12))
}

export async function prepareRemoteCwd(binding: RemoteBinding, root = defaultRemoteRoot()) {
  const dir = remoteCwd(binding, root)
  await mkdir(dir, { recursive: true })
  return dir
}

export function parseBinding(value: unknown): RemoteBinding | undefined {
  const item = value as Partial<RemoteBinding> | undefined
  return typeof item?.environment === "string" && typeof item.path === "string"
    ? { environment: item.environment, path: item.path }
    : undefined
}
