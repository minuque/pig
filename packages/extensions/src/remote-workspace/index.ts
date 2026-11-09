import { join } from "node:path"

import {
  createBashToolDefinition,
  createEditToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import {
  BINDING_ENTRY,
  environmentFor,
  parseBinding,
  type Environment,
  type RemoteBinding,
} from "@pig/environment/source"

import { readRemoteContext, syncRemoteSkills } from "./context.ts"
import { remoteOperations } from "./ops.ts"

type Active = {
  binding: RemoteBinding
  env: Environment
  context: Promise<Array<{ path: string; content: string }>>
}

/** --ssh 主机[:路径]；没给路径时用远端登录目录。 */
async function fromFlag(value: string): Promise<RemoteBinding> {
  const at = value.indexOf(":")
  const host = at === -1 ? value : value.slice(0, at)
  const environment = `ssh://${host}`

  if (at !== -1 && value.slice(at + 1)) return { environment, path: value.slice(at + 1) }
  const chunks: Buffer[] = []
  await environmentFor(environment).exec("pwd", { cwd: ".", onData: (d) => chunks.push(d) })
  return { environment, path: Buffer.concat(chunks).toString("utf8").trim() }
}

/** 会话里最近写下的远程绑定；subagent 也用它让子会话跟父会话在同一环境。 */
export function fromEntries(
  ctx: Pick<ExtensionContext, "sessionManager">,
): RemoteBinding | undefined {
  const entries = ctx.sessionManager.getEntries()

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]

    if (entry?.type === "custom" && entry.customType === BINDING_ENTRY)
      return parseBinding(entry.data)
  }

  return undefined
}

/** 远程 workspace：会话绑定一个环境里的目录后，四个内置工具、! 命令、AGENTS.md 与 skills 都走那个环境。 */
export default function remoteWorkspace(pi: ExtensionAPI) {
  let active: Active | undefined

  pi.registerFlag("ssh", { description: "SSH remote: host or host:/path", type: "string" })

  pi.on("session_start", async (_event, ctx) => {
    const flag = pi.getFlag("ssh")
    const stored = fromEntries(ctx)
    // pig 建远程会话时先把绑定写进会话文件；pi TUI 用 --ssh 指定，重开时靠写下的条目恢复
    const binding = (typeof flag === "string" && flag ? await fromFlag(flag) : undefined) ?? stored
    active = undefined

    if (!binding) return

    if (JSON.stringify(binding) !== JSON.stringify(stored)) pi.appendEntry(BINDING_ENTRY, binding)
    const env = environmentFor(binding.environment)
    const ops = remoteOperations(env, ctx.cwd, binding.path)
    pi.registerTool(createReadToolDefinition(ctx.cwd, { operations: ops.read }))
    pi.registerTool(createWriteToolDefinition(ctx.cwd, { operations: ops.write }))
    pi.registerTool(createEditToolDefinition(ctx.cwd, { operations: ops.edit }))
    pi.registerTool(createBashToolDefinition(ctx.cwd, { operations: ops.bash }))
    active = { binding, env, context: readRemoteContext(env, binding.path).catch(() => []) }
  })

  pi.on("user_bash", (event) => {
    if (!active) return undefined
    return { operations: remoteOperations(active.env, event.cwd, active.binding.path).bash }
  })

  pi.on("resources_discover", async (event) => {
    if (!active) return undefined

    const skillPaths = await syncRemoteSkills(
      active.env,
      active.binding.path,
      join(event.cwd, ".pig-skills"),
    ).catch(() => [])
    return { skillPaths }
  })

  // 系统提示里的工作目录换成远端，并补上远端的 AGENTS.md
  pi.on("before_agent_start", async (event) => {
    if (!active) return undefined
    const options = event.systemPromptOptions
    options.cwd = active.binding.path
    options.contextFiles = [...(options.contextFiles ?? []), ...(await active.context)]
    return undefined
  })

  pi.on("session_shutdown", () => {
    active = undefined
  })
}
