/**
 * 跑外部命令的统一入口，脚本里不再各写一份 spawn 包装。
 *
 * Windows 上的 pnpm / npm 是 .cmd 包装，Node 22 起不挂 shell 直接 spawn 会 EINVAL；
 * 而 shell + args 数组在 Node 24 已废弃（DEP0190）。所以需要 shell 时自己拼命令行，
 * 当成单个字符串交给 shell。
 */

import { spawn, spawnSync } from "node:child_process"

/** cmd 的元字符与空白：出现其一就得整段加引号。 */
const NEEDS_QUOTE = /[\s"&|<>^%]/
const JS_ENTRY = /\.[cm]?js$/
const SHELL_COMMAND = /\.(cmd|bat)$/i

/** @typedef {{ command: string, args: string[], options: { shell?: boolean } }} CommandPlan */

function quoteArg(value) {
  return NEEDS_QUOTE.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * 交给 shell 执行的一条命令行。
 * @param {string} command
 * @param {string[]} args
 * @returns {CommandPlan}
 */
function shellCommand(command, args) {
  return { command: [command, ...args].map(quoteArg).join(" "), args: [], options: { shell: true } }
}

/**
 * 解析 pnpm 调用方式。优先用启动器注入的 npm_execpath，没有就回落到 PATH 上的 pnpm。
 * env / platform 可注入，便于单测。
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, platform?: string }} [io]
 * @returns {CommandPlan}
 */
function pnpmCommand(args, io = {}) {
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

/**
 * 把命令和参数解析成可执行的形态，必要时改走 shell。
 * @param {string} command
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, platform?: string }} [io]
 * @returns {CommandPlan}
 */
export function buildCommand(command, args, io) {
  if (command === "pnpm") return pnpmCommand(args, io)

  if ((io?.platform ?? process.platform) === "win32" && SHELL_COMMAND.test(command))
    return shellCommand(command, args)
  return { command, args, options: {} }
}

/** 同步命令的公共 spawn 选项：Windows 上不弹控制台窗口。 */
function spawnOptions(plan, cwd) {
  return { cwd, windowsHide: true, ...plan.options }
}

/**
 * 同步跑一条命令，非零退出即抛错。capture 为真时收集 stdout 并返回，否则继承当前 stdio。
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, capture?: boolean }} [options]
 * @returns {string}
 */
export function run(command, args, { cwd, capture = false } = {}) {
  const plan = buildCommand(command, args)
  const result = spawnSync(plan.command, plan.args, {
    ...spawnOptions(plan, cwd),
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

/**
 * 异步跑 pnpm 并收集输出，给 check 的并行步骤用。不抛错，退出码交给调用方汇总。
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<{ code: number, out: string, ms: number }>}
 */
export function runPnpm(args, cwd) {
  return new Promise((resolveRun) => {
    const started = Date.now()
    const plan = pnpmCommand(args)
    const child = spawn(plan.command, plan.args, {
      ...spawnOptions(plan, cwd),
      env: { ...process.env, FORCE_COLOR: "0" },
    })
    let out = ""

    child.stdout.on("data", (chunk) => {
      out += chunk
    })
    child.stderr.on("data", (chunk) => {
      out += chunk
    })
    child.on("error", (error) => {
      resolveRun({ code: 1, out: `${out}${error.message}\n`, ms: Date.now() - started })
    })
    child.on("close", (code) => {
      resolveRun({ code: code ?? 1, out, ms: Date.now() - started })
    })
  })
}
