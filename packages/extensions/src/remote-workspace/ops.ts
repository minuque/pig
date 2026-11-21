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

// 外部：Windows 上模型给的远端绝对路径会被 path 模块加上盘符
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
