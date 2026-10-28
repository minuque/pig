import { mkdtemp, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, _electron as electron } from "@playwright/test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const desktopRoot = join(root, "apps/desktop")
/** 避开 dev:desktop 的 5555：窗控用例自己起一份 Vite。 */
const VITE_PORT = 5598
const desktopRequire = createRequire(join(desktopRoot, "package.json"))

test.skip(process.platform === "darwin", "macOS 使用原生红绿灯，不渲染自画窗控")

test("自画窗控经 IPC 操作真实窗口", async () => {
  const sessionDir = await mkdtemp(join(tmpdir(), "pig-window-controls-"))
  const app = await electron.launch({
    executablePath: desktopRequire("electron") as string,
    args: [".", "--", "--dev", `--port=${VITE_PORT}`],
    cwd: desktopRoot,
    env: {
      ...process.env,
      PIG_CDP: "0",
      PIG_VITE_PORT: String(VITE_PORT),
      PIG_SESSION_DIR: sessionDir,
      PIG_CWD: sessionDir,
    },
  })
  const isMaximized = () =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized() ?? false)

  try {
    const page = await app.firstWindow()
    const maximize = page.locator('[data-window-control="maximize"]')
    const restore = page.locator('[data-window-control="restore"]')

    await expect(page.locator('[data-window-control="minimize"]')).toBeVisible()
    await expect(maximize.or(restore)).toBeVisible()
    await expect(page.locator('[data-window-control="close"]')).toBeVisible()

    const before = await isMaximized()

    await (before ? restore : maximize).click()
    await expect.poll(isMaximized).toBe(!before)

    await (before ? maximize : restore).click()
    await expect.poll(isMaximized).toBe(before)
  } finally {
    await app.close()
    await rm(sessionDir, { recursive: true, force: true })
  }
})
