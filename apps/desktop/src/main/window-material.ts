/** 系统背景材质：Windows 走 acrylic，macOS 走 under-window。材质由系统绘制，页面只负责留出透明区域。 */
type MaterialWindow = {
  setBackgroundMaterial?: (material: "acrylic" | "none") => void
  setVibrancy?: (type: "under-window" | null) => void
}

export function applyWindowMaterial(window: MaterialWindow, platform: string, on: boolean): void {
  if (platform === "win32") window.setBackgroundMaterial?.(on ? "acrylic" : "none")
  else if (platform === "darwin") window.setVibrancy?.(on ? "under-window" : null)
}
