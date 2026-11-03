export type CommandPlan = {
  command: string
  args: string[]
  /** 需要合并进 spawn 选项；Windows 回落到 .cmd 包装时带 shell。 */
  options: { shell?: boolean }
}

/** 交给 shell 执行的一条命令行。 */
export function shellCommand(command: string, args: string[]): CommandPlan

/** 解析 pnpm 调用方式，规则见 run.mjs。 */
export function pnpmCommand(
  args: string[],
  io?: { env?: NodeJS.ProcessEnv; platform?: string },
): CommandPlan

/** 把命令和参数解析成可执行的形态，必要时改走 shell。 */
export function buildCommand(
  command: string,
  args: string[],
  io?: { env?: NodeJS.ProcessEnv; platform?: string },
): CommandPlan

/** 同步跑一条命令，非零退出即抛错；capture 为真时返回 stdout。 */
export function run(
  command: string,
  args: string[],
  options?: { cwd?: string; capture?: boolean },
): string
