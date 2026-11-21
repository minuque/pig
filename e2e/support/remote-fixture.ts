import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import {
  LocalEnvironment,
  registerEnvironment,
  type Environment,
  type ExecOptions,
} from "@pig/environment"

export const REMOTE_HOST = "e2e-host"
export const remotePathOf = (dir: string) => {
  const posix = dir.replaceAll("\\", "/")
  return posix.startsWith("/") ? posix : `/${posix}`
}
const local = (path: string) => path.replace(/^\/(?=[A-Za-z]:)/, "")

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
  realpath = async (path: string) => remotePathOf(await this.env.realpath(local(path)))
  readStream: Environment["readStream"] = (path, range) => this.env.readStream(local(path), range)
  search: Environment["search"] = (root, query, options) =>
    this.env.search(local(root), query, options)

  home = async () => remotePathOf(await this.env.home())
  close = () => this.env.close()
}

export async function prepareRemote(temp: string) {
  registerEnvironment(`ssh://${REMOTE_HOST}`, new StandInHost())
  const sshConfigPath = join(temp, "ssh-config")
  await writeFile(sshConfigPath, `Host ${REMOTE_HOST}\n  HostName 127.0.0.1\n`)
  return {
    environments: { sshConfigPath, savedPath: join(temp, "environments.json") },
    remoteRoot: join(temp, "remote-root"),
  }
}
