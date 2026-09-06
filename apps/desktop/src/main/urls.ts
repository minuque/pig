export const VITE_DEV_ORIGIN = "http://127.0.0.1:5173"

export function gatewayOrigin(port: number): string {
  return `http://127.0.0.1:${port}`
}

export function isDesktopDev(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--dev")
}
