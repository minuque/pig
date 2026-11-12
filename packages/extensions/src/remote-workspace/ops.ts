import { isAbsolute, posix, relative, sep } from "node:path"

import type {
  BashOperations,
  EditOperations,
  LsOperations,
  ReadOperations,
  WriteOperations,
} from "@earendil-works/pi-coding-agent"
import type { Environment } from "@pig/environment/source"

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
}

/**
 * 工具按本地占位 cwd 解析路径，这里换成远端路径。
 * 占位目录下的相对路径拼到远端根；模型给的远端绝对路径在 Windows 上会被带上盘符，去掉即可。
 */
export function toRemotePath(localPath: string, localCwd: string, remoteRoot: string): string {
  const rel = relative(localCwd, localPath)

  if (!rel) return remoteRoot

  if (!rel.startsWith("..") && !isAbsolute(rel))
    return posix.join(remoteRoot, rel.split(sep).join("/"))
  return localPath
    .replace(/^[A-Za-z]:/, "")
    .split(sep)
    .join("/")
}

export type RemoteOps = {
  read: ReadOperations
  write: WriteOperations
  edit: EditOperations
  bash: BashOperations
  ls: LsOperations
}

/** pi 四个内置工具的 operations，底层走环境。 */
export function remoteOperations(
  env: Environment,
  localCwd: string,
  remoteRoot: string,
): RemoteOps {
  const map = (path: string) => toRemotePath(path, localCwd, remoteRoot)
  const access = async (path: string) => {
    if (!(await env.stat(map(path)))) throw new Error(`File not found: ${map(path)}`)
  }
  const readFile = (path: string) => env.readFile(map(path))
  const writeFile = (path: string, content: string) => env.writeFile(map(path), content)
  return {
    read: {
      readFile,
      access,
      detectImageMimeType: async (path) => IMAGE_TYPES[path.split(".").pop()?.toLowerCase() ?? ""],
    },
    write: { writeFile, mkdir: (dir) => env.mkdir(map(dir)) },
    edit: { readFile, writeFile, access },
    bash: { exec: (command, cwd, options) => env.exec(command, { ...options, cwd: map(cwd) }) },
    ls: {
      exists: async (path) => Boolean(await env.stat(map(path))),
      stat: async (path) => {
        const info = await env.stat(map(path))

        if (!info) throw new Error(`Path not found: ${map(path)}`)
        return { isDirectory: () => info.kind === "directory" }
      },
      readdir: async (path) => (await env.readdir(map(path))).map((entry) => entry.name),
    },
  }
}
