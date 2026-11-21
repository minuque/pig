// 外部：Windows 上 pnpm/npm 是 .cmd，Node 22 起不带 shell 直接 spawn 会 EINVAL；shell + args 在 Node 24 已废弃（DEP0190）

import { spawn, spawnSync } from "node:child_process"

// 外部：cmd 的元字符与空白，出现其一就得整段加引号
const NEEDS_QUOTE = /[\s"&|<>^%]/
const JS_ENTRY = /\.[cm]?js$/
const SHELL_COMMAND = /\.(cmd|bat)$/i

/** @typedef {{ command: string, args: string[], options: { shell?: boolean } }} CommandPlan */
function quoteArg(value) {
  return NEEDS_QUOTE.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {CommandPlan}
 */
function shellCommand(command, args) {
  return { command: [command, ...args].map(quoteArg).join(" "), args: [], options: { shell: true } }
}

/**
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, platform?: string }} [io]
 * @returns {CommandPlan}
 */
function pnpmCommand(args, io = {}) {
  const env = io.env ?? process.env
  const platform = io.platform ?? process.platform
  const exec = env.npm_execpath

  // 外部：pnpm 12 起 npm_execpath 是可执行文件，11 及以前是 JS 入口
  if (exec && JS_ENTRY.test(exec))
    return { command: process.execPath, args: [exec, ...args], options: {} }

  if (exec) return { command: exec, args, options: {} }

  if (platform === "win32") return shellCommand("pnpm.cmd", args)
  return { command: "pnpm", args, options: {} }
}

/**
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

function spawnOptions(plan, cwd) {
  return { cwd, windowsHide: true, ...plan.options }
}

/**
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
