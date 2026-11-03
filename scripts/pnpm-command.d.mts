export type PnpmCommand = {
  command: string
  args: string[]
  /** 需要合并进 spawn 选项；Windows 回落到 PATH 时带 shell。 */
  options: { shell?: boolean }
}

/** 解析 pnpm 调用方式，规则见 pnpm-command.mjs。 */
export function pnpmCommand(
  args: string[],
  io?: { env?: NodeJS.ProcessEnv; platform?: string },
): PnpmCommand
