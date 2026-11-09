import { readFile } from "node:fs/promises"
import { basename } from "node:path"

import {
  BINDING_ENTRY,
  environmentFor,
  parseBinding,
  parseRemoteKey,
  prepareRemoteCwd,
  remoteWorkspaceKey,
  type Environment,
  type RemoteBinding,
} from "@pig/environment"

import { canonicalizePath } from "../directory.js"
import type { StagedAttachment } from "./attachments.js"

export { BINDING_ENTRY, parseRemoteKey, prepareRemoteCwd }

type EntryReader = { getCwd(): string; getEntries(): ReadonlyArray<unknown> }

/** 会话里最近一次写下的远程绑定。 */
export function sessionBinding(entries: ReadonlyArray<unknown>): RemoteBinding | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index] as { type?: string; customType?: string; data?: unknown }

    if (entry?.type === "custom" && entry.customType === BINDING_ENTRY)
      return parseBinding(entry.data)
  }

  return undefined
}

/** 会话对外的 workspace 键：远程会话是 ssh://主机/路径，本地会话是规范化的 cwd。 */
export function sessionWorkspace(manager: EntryReader): string {
  const binding = sessionBinding(manager.getEntries())
  return binding ? remoteWorkspaceKey(binding) : canonicalizePath(manager.getCwd())
}

/** 平台功能（搜文件、列目录）在哪个环境、哪个根目录下做。 */
export function workspaceEnvironment(workspace: string): { env: Environment; root: string } {
  const binding = parseRemoteKey(workspace)
  return binding
    ? { env: environmentFor(binding.environment), root: binding.path }
    : { env: environmentFor("local"), root: workspace }
}

/** 远程目录校验：必须是该环境里存在的目录，返回规范的 workspace 键。 */
export async function validateRemoteDirectory(environment: string, path: string) {
  const binding = parseRemoteKey(`${environment}${path.startsWith("/") ? "" : "/"}${path}`)

  if (!binding) return undefined
  const stat = await environmentFor(binding.environment).stat(binding.path)
  return stat?.kind === "directory" ? canonicalizePath(remoteWorkspaceKey(binding)) : undefined
}

const REMOTE_ATTACHMENTS = "/tmp/pig-attachments"

/** 远程会话的非图片附件传到远端临时目录，提示里写远端路径；图片仍随消息内联。 */
export async function uploadAttachments(
  binding: RemoteBinding,
  staged: readonly StagedAttachment[],
): Promise<StagedAttachment[]> {
  const env = environmentFor(binding.environment)

  if (staged.some((item) => item.kind === "file")) await env.mkdir(REMOTE_ATTACHMENTS)
  return Promise.all(
    staged.map(async (item) => {
      if (item.kind !== "file") return item
      const path = `${REMOTE_ATTACHMENTS}/${basename(item.path)}`
      await env.writeFile(path, await readFile(item.path))
      return { ...item, path }
    }),
  )
}
