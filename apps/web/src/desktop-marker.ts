/** 仅当 URL 带合法 `pig-desktop-platform` 时给根节点打桌面展示标记。 */
export function applyDesktopPresentationMarker(href: string, root: HTMLElement): void {
  const platform = new URL(href).searchParams.get("pig-desktop-platform");
  if (platform !== "darwin" && platform !== "win32" && platform !== "linux") return;
  root.dataset.pigDesktopPlatform = platform;
}
