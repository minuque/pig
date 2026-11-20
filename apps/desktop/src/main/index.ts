import { access } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { ChildProcess } from "node:child_process"
import {
  app,
  dialog,
  ipcMain,
  Menu,
  screen,
  session,
  utilityProcess,
  type BrowserWindow,
  type OpenDialogOptions,
} from "electron"

import { handlePigProtocol, registerPigScheme } from "./protocol.js"
import {
  desktopCdpPort,
  gatewayOrigin,
  gatewayTrustUrls,
  isDesktopBench,
  isDesktopDev,
  pigAppUrl,
  viteDevOrigin,
} from "./urls.js"
import { killVite, spawnVite, waitForHttp } from "./vite-child.js"
import { connectGateway, type GatewayProcess } from "./gateway-process.js"
import { createMainWindow } from "./window.js"
import { loadWithRetry } from "./load-retry.js"
import { parseThemeColor } from "./theme-color.js"
import { registerWindowControls } from "./window-controls.js"
import { resolveWebRoot } from "./paths.js"
import {
  readWindowStateFile,
  restoreWindowFrame,
  windowStatePath,
  writeWindowStateFile,
} from "./window-state.js"

registerPigScheme()

const cdpPort = desktopCdpPort()

if (cdpPort) {
  // 命令行 --remote-debugging-port 在本壳无效，须 ready 前 appendSwitch。
  app.commandLine.appendSwitch("remote-debugging-port", cdpPort)
  app.commandLine.appendSwitch("remote-allow-origins", "*")
}

const DIALOG_OPTIONS = {
  title: "选择工作目录",
  properties: ["openDirectory", "createDirectory"],
} as const satisfies OpenDialogOptions

function trustLoopback(port: number, token: string): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: gatewayTrustUrls(port) },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          Authorization: `Bearer ${token}`,
        },
      })
    },
  )
}

let gateway: GatewayProcess | undefined
let vite: ChildProcess | undefined
let mainWindow: BrowserWindow | undefined
let stopping = false

async function pickDirectory(): Promise<string | undefined> {
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, DIALOG_OPTIONS)
    : await dialog.showOpenDialog(DIALOG_OPTIONS)
  return result.canceled ? undefined : result.filePaths[0]
}

function startGateway(isPackaged: boolean, webRoot: string | undefined): Promise<GatewayProcess> {
  const entry = new URL(
    isPackaged ? "./gateway-child.js" : "../../gateway-child.mjs",
    import.meta.url,
  )
  const args = [...(webRoot ? ["--web-root", webRoot] : []), ...(isPackaged ? ["--packaged"] : [])]
  // 主进程 stdout 是管道时，默认的 inherit 收不到子进程输出；扩展报错靠 console.error 露出来
  const child = utilityProcess.fork(fileURLToPath(entry), args, {
    serviceName: "pig-gateway",
    stdio: "pipe",
  })

  child.stdout?.pipe(process.stdout)
  child.stderr?.pipe(process.stderr)
  return connectGateway(child, {
    pickDirectory,
    onUnexpectedExit(code) {
      gateway = undefined
      dialog.showErrorBox("网关已退出", `后台网关进程意外退出（退出码 ${code}），应用将关闭。`)
      void shutdown()
    },
  })
}

async function shutdown(): Promise<void> {
  if (stopping) return
  stopping = true

  if (vite) killVite(vite)
  vite = undefined

  try {
    await gateway?.stop()
  } finally {
    gateway = undefined
    app.quit()
  }
}

function onInterrupt(): void {
  if (vite) {
    killVite(vite)
    vite = undefined
  }

  void shutdown()
}

process.once("SIGINT", onInterrupt)

process.once("SIGTERM", onInterrupt)

if (process.platform === "win32") process.once("SIGBREAK", onInterrupt)

process.once("exit", () => {
  if (vite) killVite(vite)
})

app.on("window-all-closed", () => {
  void shutdown()
})

app.on("before-quit", (event) => {
  if (stopping) return
  event.preventDefault()
  void shutdown()
})

void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  try {
    const isDev = isDesktopDev()
    const isPackaged = app.isPackaged
    const webRoot = resolveWebRoot(isDev, isPackaged, import.meta.url, process.resourcesPath)
    const preloadPath = fileURLToPath(new URL("../preload/index.js", import.meta.url))

    if (webRoot) {
      try {
        await access(webRoot)
      } catch {
        dialog.showErrorBox(
          "无法启动",
          isPackaged
            ? "安装包资源缺失。"
            : "未找到 Web 构建产物（apps/web/dist）。请先执行 pnpm build:web。",
        )
        await shutdown()
        return
      }
    }

    gateway = await startGateway(isPackaged, webRoot)
    const httpOrigin = gatewayOrigin(gateway.port)
    const launchToken = gateway.launchToken
    trustLoopback(gateway.port, launchToken)

    if (isDev) {
      vite = spawnVite({ GATEWAY_TARGET: httpOrigin, GATEWAY_TOKEN: launchToken })
      await waitForHttp(viteDevOrigin(), 60_000, vite)
    } else {
      if (!webRoot) throw new Error("桌面壳缺少 Web 资源")
      handlePigProtocol(httpOrigin, webRoot, launchToken)
    }

    const stateFile = windowStatePath(app.getPath("userData"))
    const displays = screen.getAllDisplays().map((display) => display.bounds)
    const frame = restoreWindowFrame(readWindowStateFile(stateFile), displays)
    ipcMain.on("pig:theme-color", (_event, value: unknown) => {
      const color = parseThemeColor(value)

      if (!color) return
      mainWindow?.setBackgroundColor(color)
    })
    registerWindowControls(() => mainWindow)
    mainWindow = createMainWindow(preloadPath, {
      ...(isDev ? {} : { gatewayOrigin: httpOrigin }),
      frame,
      persistState: (state) => writeWindowStateFile(stateFile, state),
    })

    const origin = isDev ? viteDevOrigin() : pigAppUrl()
    process.env.PIG_GATEWAY_ORIGIN = origin
    const window = mainWindow
    await loadWithRetry(() => window.loadURL(isDesktopBench() ? "about:blank" : origin))
  } catch (error) {
    dialog.showErrorBox("无法启动", error instanceof Error ? error.message : String(error))
    await shutdown()
  }
})
