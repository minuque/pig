/** URL 合法则写入。无 query 时保留已有标记（桌面 preload 会先打上）。 */
export function applyDesktopPresentationMarker(href: string, root: HTMLElement): void {
  const platform = new URL(href).searchParams.get("pig-desktop-platform")
  if (platform !== "darwin" && platform !== "win32" && platform !== "linux") return
  root.dataset.pigDesktopPlatform = platform
}
