import { mkdtemp, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, _electron as electron } from "@playwright/test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const desktopRoot = join(root, "apps/desktop")
/** 避开 dev:desktop 的 5555：材质用例自己起一份 Vite。 */
const VITE_PORT = 5597
const desktopRequire = createRequire(join(desktopRoot, "package.json"))

type MaterialWindow = {
  window?: { setTranslucent?: (on: boolean) => void }
}

test("半透明开关经 IPC 打到窗口材质", async () => {
  const sessionDir = await mkdtemp(join(tmpdir(), "pig-window-material-"))
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

    // 等页面自身加载完再注入脚本，否则 evaluate 会卡在导航换上下文
    await expect(page).toHaveTitle("pig")
    await expect(page.locator("#app")).not.toBeEmpty()

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            typeof (window as unknown as { pigDesktop?: MaterialWindow }).pigDesktop?.window
              ?.setTranslucent,
        ),
      )
      .toBe("function")

    // 记下主进程收到的材质调用；原方法照常执行
    await app.evaluate(({ BrowserWindow }) => {
      const proto = BrowserWindow.prototype as unknown as Record<
        string,
        (...args: unknown[]) => void
      >
      const calls: unknown[][] = []

      ;(globalThis as { __materialCalls?: unknown[][] }).__materialCalls = calls

      for (const name of ["setBackgroundMaterial", "setVibrancy"]) {
        const original = proto[name]

        if (!original) continue
        proto[name] = function (this: unknown, ...args: unknown[]) {
          calls.push([name, ...args])
          return original.apply(this, args)
        }
      }
    })

    const calls = () =>
      app.evaluate(() => (globalThis as { __materialCalls?: unknown[][] }).__materialCalls ?? [])

    await page.evaluate(() =>
      (window as unknown as { pigDesktop: MaterialWindow }).pigDesktop.window?.setTranslucent?.(
        true,
      ),
    )

    if (process.platform === "win32")
      await expect.poll(calls).toContainEqual(["setBackgroundMaterial", "acrylic"])
    else if (process.platform === "darwin")
      await expect.poll(calls).toContainEqual(["setVibrancy", "under-window"])

    await page.evaluate(() =>
      (window as unknown as { pigDesktop: MaterialWindow }).pigDesktop.window?.setTranslucent?.(
        false,
      ),
    )

    if (process.platform === "win32")
      await expect.poll(calls).toContainEqual(["setBackgroundMaterial", "none"])
    else if (process.platform === "darwin")
      await expect.poll(calls).toContainEqual(["setVibrancy", null])
  } finally {
    await app.close()
    await rm(sessionDir, { recursive: true, force: true })
  }
})
