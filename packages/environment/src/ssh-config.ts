import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { homedir, userInfo } from "node:os"
import { join } from "node:path"

import SSHConfig, { LineType, type Line } from "ssh-config"
import type { ConnectConfig } from "ssh2"

export const defaultSshConfigPath = () => join(homedir(), ".ssh", "config")
const DEFAULT_KEYS = ["id_ed25519", "id_ecdsa", "id_rsa"]
const WINDOWS_AGENT = String.raw`\\.\pipe\openssh-ssh-agent`

/** 读 ssh config；文件不存在当作空配置。 */
export async function readSshConfig(path = defaultSshConfigPath()): Promise<SSHConfig> {
  const text = await readFile(path, "utf8").catch(() => "")
  return SSHConfig.parse(text)
}

const values = (line: Line): string[] => {
  if (line.type !== LineType.DIRECTIVE) return []
  return typeof line.value === "string" ? line.value.split(/\s+/) : line.value.map((v) => v.val)
}

/** 配置里能直接连的主机别名：跳过通配与取反模式。 */
export function sshHosts(config: SSHConfig): string[] {
  const hosts = config.flatMap((line) =>
    line.type === LineType.DIRECTIVE && line.param.toLowerCase() === "host" ? values(line) : [],
  )
  return [...new Set(hosts.filter((host) => host && !/[*?!]/.test(host)))]
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const expandHome = (path: string) => path.replace(/^~(?=$|[\\/])/, homedir())

/** 按别名算出 ssh2 的连接参数：主机、端口、用户、私钥与 ssh-agent。 */
export async function connectConfig(alias: string, config?: SSHConfig): Promise<ConnectConfig> {
  const computed = (config ?? (await readSshConfig())).compute(alias, {
    ignoreCase: true,
    matchExec: false,
  })
  const identities = [computed.identityfile ?? []]
    .flat()
    .map(expandHome)
    .concat(DEFAULT_KEYS.map((name) => join(homedir(), ".ssh", name)))
  const key = identities.find((path) => existsSync(path))
  const agent =
    process.env.SSH_AUTH_SOCK ??
    (process.platform === "win32" && existsSync(WINDOWS_AGENT) ? WINDOWS_AGENT : undefined)
  return {
    host: first(computed.hostname) ?? alias,
    port: Number(first(computed.port) ?? 22),
    username: first(computed.user) ?? userInfo().username,
    ...(key ? { privateKey: await readFile(key) } : {}),
    ...(agent ? { agent } : {}),
    keepaliveInterval: 15_000,
    readyTimeout: 20_000,
  }
}
