import type { BrowserWindowConstructorOptions, TitleBarOverlay } from "electron"

const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const
/** 标题条行高：窗口控件与工作台头部共用这一行，和 web 的 --header-height 对齐。 */
export const TITLEBAR_HEIGHT = 44

/** 按平台返回窗口铬层；不含 preload / 窗控 IPC。 */
export function windowChromeFor(platform: string): BrowserWindowConstructorOptions {
  const webPreferences = { ...SECURE_WEB_PREFERENCES }

  if (platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset",
      // 红绿灯在 44px 条带里竖直居中（12px 高）
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences,
    }
  }

  // Windows 藏起标题条，只留系统画的窗控按钮浮在页面右上角：按钮和头部同一行。
  // thickFrame 保住贴边缩放与 Aero Snap，roundedCorners 保住系统圆角。
  if (platform === "win32") {
    return {
      titleBarStyle: "hidden",
      titleBarOverlay: titleBarOverlayFor(undefined),
      thickFrame: true,
      roundedCorners: true,
      autoHideMenuBar: true,
      webPreferences,
    }
  }

  // Linux 上无边框窗口的缩放命中带、系统阴影与窗口管理器行为都不可靠，保留原生边框。
  if (platform === "linux") {
    return { frame: true, webPreferences }
  }

  return { webPreferences }
}

/** 窗控底透明，露出页面自己的头部底色；符号色随主题深浅切换。 */
export function titleBarOverlayFor(background: string | undefined): TitleBarOverlay {
  return {
    color: "#00000000",
    symbolColor: symbolColorFor(background),
    height: TITLEBAR_HEIGHT,
  }
}

/** 按窗口底色挑窗控符号色：浅底配深色，深底配浅色。 */
function symbolColorFor(background: string | undefined): string {
  const rgb = parseRgb(background)

  if (!rgb) return "#8a8d94"
  const [r, g, b] = rgb
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 140 ? "#1b1b1b" : "#d9d9de"
}

/** 渲染进程上报的底色可能是 #rgb、#rrggbb 或 rgb() 三种写法。 */
function parseRgb(color: string | undefined): [number, number, number] | undefined {
  if (!color) return undefined

  const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color)

  if (rgb) {
    const [, r = "0", g = "0", b = "0"] = rgb
    return [Number(r), Number(g), Number(b)]
  }

  const [, digits] = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color) ?? []

  if (!digits) return undefined

  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ]
}

/** 去掉 Electron 默认 File/Edit/View 菜单，避免占出原生标题条。 */
export function stripNativeMenu(window: {
  setMenu(menu: null): void
  setMenuBarVisibility(visible: boolean): void
}): void {
  window.setMenu(null)
  window.setMenuBarVisibility(false)
}
