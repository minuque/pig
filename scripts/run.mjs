/**
 * 跑外部命令的统一入口，脚本里不再各写一份 spawn 包装。
 *
 * Windows 上的 pnpm / npm 是 .cmd 包装，Node 22 起不挂 shell 直接 spawn 会 EINVAL；
 * 而 shell + args 数组在 Node 24 已废弃（DEP0190）。所以需要 shell 时自己拼命令行，
 * 当成单个字符串交给 shell。
 */

import { spawnSync } from "node:child_process"

/** cmd 的元字符与空白：出现其一就得整段加引号。 */
const NEEDS_QUOTE = /[\s"&|<>^%]/
const JS_ENTRY = /\.[cm]?js$/
const SHELL_COMMAND = /\.(cmd|bat)$/i

function quoteArg(value) {
  return NEEDS_QUOTE.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/** 交给 shell 执行的一条命令行。 */
export function shellCommand(command, args) {
  return { command: [command, ...args].map(quoteArg).join(" "), args: [], options: { shell: true } }
}

/**
 * pnpm 调用入口。优先用启动器注入的 npm_execpath，没有就回落到 PATH 上的 pnpm。
 * env / platform 可注入，便于单测。
 */
export function pnpmCommand(args, io = {}) {
  const env = io.env ?? process.env
  const platform = io.platform ?? process.platform
  const exec = env.npm_execpath

  // pnpm 12 起 npm_execpath 是可执行文件，11 及以前是 JS 入口，要经 node 启动
  if (exec && JS_ENTRY.test(exec))
    return { command: process.execPath, args: [exec, ...args], options: {} }

  if (exec) return { command: exec, args, options: {} }

  if (platform === "win32") return shellCommand("pnpm.cmd", args)
  return { command: "pnpm", args, options: {} }
}

/** 把命令和参数解析成可执行的形态，必要时改走 shell。 */
export function buildCommand(command, args, io) {
  if (command === "pnpm") return pnpmCommand(args, io)

  if ((io?.platform ?? process.platform) === "win32" && SHELL_COMMAND.test(command))
    return shellCommand(command, args)
  return { command, args, options: {} }
}

/**
 * 同步跑一条命令，非零退出即抛错。
 * capture 为真时收集 stdout 并返回，否则继承当前 stdio。
 */
export function run(command, args, { cwd, capture = false } = {}) {
  const plan = buildCommand(command, args)
  const result = spawnSync(plan.command, plan.args, {
    cwd,
    windowsHide: true,
    ...plan.options,
    stdio: capture ? "pipe" : "inherit",
    encoding: capture ? "utf8" : undefined,
  })

  if (result.error)
    throw new Error(`${command} 无法启动: ${result.error.message}`, { cause: result.error })

  if (result.status)
    throw new Error(
      `${command} ${args[0] ?? ""} 失败（exit ${result.status}）${result.stderr ? `: ${result.stderr}` : ""}`,
    )
  return result.stdout ?? ""
}
