import { mkdtemp, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, _electron as electron } from "@playwright/test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const desktopRoot = join(root, "apps/desktop")
/** 避开 dev:desktop 的 5555：冒烟自己起一份 Vite。 */
const VITE_PORT = 5599
const desktopRequire = createRequire(join(desktopRoot, "package.json"))

type PreloadBridge = { setThemeColor?: unknown }

test("桌面壳启动：preload、网关与渲染进程都就位", async () => {
  const sessionDir = await mkdtemp(join(tmpdir(), "pig-desktop-smoke-"))
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

  try {
    const page = await app.firstWindow()

    await expect(page).toHaveURL(new RegExp(`^http://127\\.0\\.0\\.1:${VITE_PORT}/`))
    await expect(page).toHaveTitle("pig")
    // preload 注入的平台标记与 contextBridge，缺一个说明主进程链没接通
    expect(await page.evaluate(() => document.documentElement.dataset.pigDesktopPlatform)).toBe(
      process.platform,
    )
    expect(
      await page.evaluate(
        () =>
          typeof (window as unknown as { pigDesktop?: PreloadBridge }).pigDesktop?.setThemeColor,
      ),
    ).toBe("function")
    // 渲染进程真的把界面画出来了，不只是空白外壳
    await expect(page.locator("#app")).not.toBeEmpty()
  } finally {
    await app.close()
    await rm(sessionDir, { recursive: true, force: true })
  }
})
