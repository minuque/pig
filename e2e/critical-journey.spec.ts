import { checkpoint } from "./checkpoint.js"
import { expect, test } from "./fixtures.js"

test("Chromium production SPA 关键旅程", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(
    ({ workspaceId }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([workspaceId]))
      localStorage.setItem("pig.lastCwd", workspaceId)
      localStorage.setItem("npg-theme", "light")
    },
    { workspaceId: gateway.workspaceId },
  )

  await page.goto(gateway.origin)
  const sessionList = page.locator("nav.session-list")
  await expect(sessionList).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("正在连接…")).toHaveCount(0)
  await checkpoint(page, "01-startup")

  await expect(sessionList).toBeVisible()
  await expect(page.getByText("还没有工作目录")).toHaveCount(0)
  await checkpoint(page, "02-session-inbox")

  await expect(page.locator("h1.hero-title")).toBeVisible()
  await checkpoint(page, "03-empty-canvas")

  const prompt = page.getByRole("textbox", { name: "Prompt" })
  const send = page.locator("button.send")
  await expect(prompt).toBeVisible()
  await prompt.fill("e2e composer")
  await expect(send).toBeEnabled()
  await expect(page.locator(".selector-name")).toBeVisible()
  await checkpoint(page, "04-composer")
})
