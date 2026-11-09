import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import {
  LocalEnvironment,
  registerEnvironment,
  type Environment,
  type ExecOptions,
} from "@pig/environment"

export const REMOTE_HOST = "e2e-host"
/** 本机路径写成远端的 POSIX 绝对路径：Windows 上是 /C:/...，替身再去掉前导斜杠。 */
export const remotePathOf = (dir: string) => {
  const posix = dir.replaceAll("\\", "/")
  return posix.startsWith("/") ? posix : `/${posix}`
}
const local = (path: string) => path.replace(/^\/(?=[A-Za-z]:)/, "")

/** 用本机目录充当 SSH 主机：路径换回本机拼写后交给本机环境。 */
class StandInHost implements Environment {
  readonly id = `ssh://${REMOTE_HOST}`
  private readonly env = new LocalEnvironment()

  exec(command: string, options: ExecOptions) {
    return this.env.exec(command, { ...options, cwd: local(options.cwd) })
  }

  readFile = (path: string) => this.env.readFile(local(path))
  writeFile = (path: string, content: string | Buffer) => this.env.writeFile(local(path), content)
  mkdir = (path: string) => this.env.mkdir(local(path))
  stat = (path: string) => this.env.stat(local(path))
  readdir = (path: string) => this.env.readdir(local(path))
  search: Environment["search"] = (root, query, options) =>
    this.env.search(local(root), query, options)

  close = () => this.env.close()
}

/** 登记替身主机，并写一份只含它的 ssh config 给环境列表用。 */
export async function prepareRemote(temp: string) {
  registerEnvironment(`ssh://${REMOTE_HOST}`, new StandInHost())
  const sshConfigPath = join(temp, "ssh-config")
  await writeFile(sshConfigPath, `Host ${REMOTE_HOST}\n  HostName 127.0.0.1\n`)
  return {
    environments: { sshConfigPath, savedPath: join(temp, "environments.json") },
    remoteRoot: join(temp, "remote-root"),
  }
}
