import { mkdtemp, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test, _electron as electron } from "@playwright/test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const desktopRoot = join(root, "apps/desktop")
/** 避开 dev:desktop 的 5555：冒烟自己起一份 Vite。 */
const VITE_PORT = 5598
const desktopRequire = createRequire(join(desktopRoot, "package.json"))

test("window.open 被主进程拒绝，不新开 Electron 窗口", async () => {
  const sessionDir = await mkdtemp(join(tmpdir(), "pig-desktop-links-"))
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

    const opened = await page.evaluate(() => window.open("about:blank", "_blank"))

    expect(opened).toBeNull()
    expect(app.windows()).toHaveLength(1)
  } finally {
    await app.close()
    await rm(sessionDir, { recursive: true, force: true })
  }
})
