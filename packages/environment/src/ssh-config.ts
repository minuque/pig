import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { homedir, userInfo } from "node:os"
import { join } from "node:path"

import SSHConfig, { LineType, type Line } from "ssh-config"
import ssh2, { type ConnectConfig } from "ssh2"

import { knownHostKeys } from "./known-hosts.js"

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
/** 可写多项的指令（如 UserKnownHostsFile），按空白拆开。 */
const list = (value: string | string[] | undefined) =>
  [value ?? []].flat().flatMap((item) => item.split(/\s+/).filter(Boolean))
const GLOBAL_KNOWN_HOSTS =
  process.platform === "win32"
    ? join(process.env.PROGRAMDATA ?? String.raw`C:\ProgramData`, "ssh", "ssh_known_hosts")
    : "/etc/ssh/ssh_known_hosts"

/** 第一把能直接用的私钥：带口令的跳过，交给 ssh-agent。 */
async function usableKey(paths: readonly string[]) {
  for (const path of paths) {
    if (!existsSync(path)) continue
    const data = await readFile(path)

    if (!(ssh2.utils.parseKey(data) instanceof Error)) return data
  }

  return undefined
}

/** 按别名算出 ssh2 的连接参数：主机、端口、用户、私钥、ssh-agent 与 known_hosts 校验。 */
export async function connectConfig(alias: string, config?: SSHConfig): Promise<ConnectConfig> {
  const computed = (config ?? (await readSshConfig())).compute(alias, {
    ignoreCase: true,
    matchExec: false,
  })
  const host = first(computed.hostname) ?? alias
  const port = Number(first(computed.port) ?? 22)
  const userFiles = list(computed.userknownhostsfile).map(expandHome)
  const knownFiles = [
    ...(userFiles.length
      ? userFiles
      : ["known_hosts", "known_hosts2"].map((name) => join(homedir(), ".ssh", name))),
    ...list(computed.globalknownhostsfile).map(expandHome),
    GLOBAL_KNOWN_HOSTS,
  ]
  const { trusted, revoked } = await knownHostKeys(
    knownFiles,
    first(computed.hostkeyalias) ?? host,
    port,
  )

  if (trusted.length === 0)
    throw new Error(`${alias} is not in known_hosts; run \`ssh ${alias}\` once to trust it`)

  const key = await usableKey(
    [computed.identityfile ?? []]
      .flat()
      .map(expandHome)
      .concat(DEFAULT_KEYS.map((name) => join(homedir(), ".ssh", name))),
  )
  const agent =
    process.env.SSH_AUTH_SOCK ??
    (process.platform === "win32" && existsSync(WINDOWS_AGENT) ? WINDOWS_AGENT : undefined)
  return {
    host,
    port,
    username: first(computed.user) ?? userInfo().username,
    ...(key ? { privateKey: key } : {}),
    ...(agent ? { agent } : {}),
    hostVerifier: (presented: Buffer) =>
      !revoked.some((item) => item.equals(presented)) &&
      trusted.some((item) => item.equals(presented)),
    keepaliveInterval: 15_000,
    readyTimeout: 20_000,
  }
}
