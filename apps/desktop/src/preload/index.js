// preload 以 sandbox 脚本加载，没有 ESM 加载器，只能 require。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron")
// 只向 renderer 暴露窗口底色上报：渲染进程换主题时调用，主进程据此改窗口底色。
const GATEWAY_ORIGIN_ARG_PREFIX = "--pig-gateway-origin="

function stampDesktopPlatform() {
  const platform = process.platform

  if (platform !== "darwin" && platform !== "win32" && platform !== "linux") return

  if (!document.documentElement) return
  document.documentElement.dataset.pigDesktopPlatform = platform
}

function stampGatewayOrigin() {
  const arg = process.argv.find((item) => item.startsWith(GATEWAY_ORIGIN_ARG_PREFIX))

  if (!arg) return

  try {
    const url = new URL(arg.slice(GATEWAY_ORIGIN_ARG_PREFIX.length))

    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return

    if (!document.documentElement) return
    document.documentElement.dataset.pigGatewayOrigin = url.origin
  } catch {
    /* 非法参数忽略 */
  }
}

function stamp() {
  stampDesktopPlatform()
  stampGatewayOrigin()
}

contextBridge.exposeInMainWorld("pigDesktop", {
  setThemeColor(color) {
    ipcRenderer.send("pig:theme-color", color)
  },
})

stamp()

document.addEventListener("DOMContentLoaded", stamp)
