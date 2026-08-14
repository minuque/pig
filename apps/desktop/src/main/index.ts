import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ChildProcess } from "node:child_process";
import { app, dialog } from "electron";

// gateway 的 package exports 指向 dist，开发时可能没有
import Gateway from "../../../../packages/gateway/src/index.js";
import { VITE_DEV_ORIGIN, bootstrapAppUrl, gatewayOrigin, isDesktopDev } from "./urls.js";
import { killVite, spawnVite, waitForHttp } from "./vite-child.js";
import { createMainWindow } from "./window.js";

const PRELOAD_PATH = fileURLToPath(new URL("../preload/index.js", import.meta.url));

let gateway: Gateway | undefined;
let vite: ChildProcess | undefined;
let stopping = false;

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (vite) killVite(vite);
  vite = undefined;
  try {
    await gateway?.stop();
  } finally {
    gateway = undefined;
    app.quit();
  }
}

app.on("window-all-closed", () => {
  // 单窗口本地工具：关窗必须释放端口，darwin 也退出
  void shutdown();
});

app.on("before-quit", (event) => {
  if (stopping) return;
  event.preventDefault();
  void shutdown();
});

void app.whenReady().then(async () => {
  try {
    const secret = randomUUID();
    const isDev = isDesktopDev();
    const webRoot = isDev
      ? undefined
      : fileURLToPath(new URL("../../../web/dist", import.meta.url));

    if (webRoot) {
      try {
        await access(webRoot);
      } catch {
        dialog.showErrorBox(
          "无法启动",
          "未找到 Web 构建产物（apps/web/dist）。请先执行 pnpm --filter @pig/web build。",
        );
        await shutdown();
        return;
      }
    }

    gateway = new Gateway({
      bootstrapSecret: secret,
      bootstrapTtlMs: Number.POSITIVE_INFINITY,
      ...(webRoot ? { webRoot } : {}),
    });
    const port = await gateway.start();

    if (isDev) {
      vite = spawnVite({ GATEWAY_TARGET: gatewayOrigin(port) });
      await waitForHttp(VITE_DEV_ORIGIN);
    }

    const window = createMainWindow(PRELOAD_PATH);

    await window.loadURL(bootstrapAppUrl(isDev ? VITE_DEV_ORIGIN : gatewayOrigin(port), secret));
  } catch (error) {
    dialog.showErrorBox("无法启动", error instanceof Error ? error.message : String(error));
    await shutdown();
  }
});
