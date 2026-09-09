export const VITE_DEV_ORIGIN = "http://127.0.0.1:5173"

export function gatewayOrigin(port: number): string {
  return `http://127.0.0.1:${port}`
}

export function isDesktopDev(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--dev")
}

/** 基准进程：窗口先空着，由 Playwright 注入观察器后再打开工作台。 */
export function isDesktopBench(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PIG_BENCH === "1"
}
