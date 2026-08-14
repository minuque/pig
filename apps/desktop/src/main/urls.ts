export const VITE_DEV_ORIGIN = "http://127.0.0.1:5173";

export function gatewayOrigin(port: number): string {
  return `http://127.0.0.1:${port}`;
}

/** 组装窗口要 load 的启动 URL（含一次性 bootstrap hash）。 */
export function bootstrapAppUrl(origin: string, secret: string): string {
  const url = new URL(origin);
  url.hash = `bootstrap=${encodeURIComponent(secret)}`;
  return url.href;
}

export function isDesktopDev(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--dev");
}
