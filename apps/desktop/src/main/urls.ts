export const VITE_DEV_ORIGIN = "http://127.0.0.1:5173";

export function gatewayOrigin(port: number): string {
  return `http://127.0.0.1:${port}`;
}

const DESKTOP_PLATFORMS = new Set(["darwin", "win32", "linux"]);

/** 组装窗口要 load 的启动 URL（含一次性 bootstrap hash）。合法桌面平台会带 pig-desktop-platform。 */
export function bootstrapAppUrl(origin: string, secret: string, platform?: string): string {
  const url = new URL(origin);
  if (platform && DESKTOP_PLATFORMS.has(platform)) {
    url.searchParams.set("pig-desktop-platform", platform);
  }
  url.hash = `bootstrap=${encodeURIComponent(secret)}`;
  return url.href;
}

export function isDesktopDev(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--dev");
}
