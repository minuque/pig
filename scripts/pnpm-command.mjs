/**
 * pnpm 调用入口。优先用启动器注入的 npm_execpath，没有就回落到 PATH 上的 pnpm。
 *
 * Windows 上 PATH 里的 pnpm 是 corepack 的 .cmd 包装，Node 22 起不挂 shell 就抛
 * EINVAL；而 shell + args 数组在 Node 24 已废弃（DEP0190），所以回落到 PATH 时
 * 自己拼命令行，交给 shell 当单个字符串执行。env / platform 可注入，便于单测。
 */

/** @typedef {{ command: string, args: string[], options: { shell?: boolean } }} PnpmCommand */

const JS_ENTRY = /\.[cm]?js$/
/** cmd 的元字符与空白：出现其一就得整段加引号。 */
const NEEDS_QUOTE = /[\s"&|<>^%]/

function quoteArg(value) {
  return NEEDS_QUOTE.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, platform?: string }} [io]
 * @returns {PnpmCommand}
 */
export function pnpmCommand(args, io = {}) {
  const env = io.env ?? process.env
  const platform = io.platform ?? process.platform
  const exec = env.npm_execpath

  // pnpm 12 起 npm_execpath 是可执行文件，11 及以前是 JS 入口，要经 node 启动
  if (exec && JS_ENTRY.test(exec))
    return { command: process.execPath, args: [exec, ...args], options: {} }

  if (exec) return { command: exec, args, options: {} }

  if (platform === "win32")
    return {
      command: ["pnpm.cmd", ...args].map(quoteArg).join(" "),
      args: [],
      options: { shell: true },
    }
  return { command: "pnpm", args, options: {} }
}
