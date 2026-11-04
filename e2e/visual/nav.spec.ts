import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test, type E2eGateway } from "../fixtures.js"
import { TURN_PROMPT, installTurnBridge } from "../sim-turn.js"
import { stabilize } from "./lib/stabilize.js"

test.describe("sidebar 视觉", () => {
  test.use({ deviceScaleFactor: 1 })

  async function enter(page: Page, gateway: E2eGateway) {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await seedWorkspace(page, gateway.workspaceId)
    // 两个归档、一个在跑、三个留在收件箱，三段同屏可比
    await page.addInitScript(() => {
      localStorage.setItem(
        "pig.sidebarSettledSessions",
        JSON.stringify(["e2e-filler-1", "e2e-filler-2"]),
      )
    })
    await page.goto(gateway.entryUrl)
    await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  }

  /** 发一条 prompt 让会话停在 turn 里，工作中架子才有内容。 */
  async function startWorking(page: Page, bridge: Awaited<ReturnType<typeof installTurnBridge>>) {
    await page.locator(".session-card", { hasText: "批量会话 6" }).click()
    await page.getByRole("textbox", { name: "Prompt" }).fill(TURN_PROMPT)
    await page.locator("button.send").click()
    await bridge.waitForPrompt()
    await page.locator('.session-section[data-key="working"]').waitFor()
  }

  test("收件箱与架子", async ({ page, navGateway }) => {
    const bridge = await installTurnBridge(page)

    await enter(page, navGateway)
    await startWorking(page, bridge)

    const nav = page.locator(".session-nav")
    const mask = await stabilize(page, [])
    // 秒表每秒变一次：盖住数字并定宽，基线不随读数漂移
    await page.addStyleTag({
      content: ".working-elapsed { display: inline-block; width: 22px; visibility: hidden; }",
    })

    await expect(nav).toHaveScreenshot("sidebar-inbox.png", { mask })

    await page.locator('.session-section[data-key="working"] .section-toggle').click()
    await page.locator('.session-section[data-key="settled"] .section-toggle').click()
    await expect(page.locator('.session-section[data-key="settled"] .session-card')).toHaveCount(2)

    await expect(nav).toHaveScreenshot("sidebar-shelves.png", { mask })
  })
})
