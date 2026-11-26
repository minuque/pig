import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test } from "../support/fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "../support/prebuild-session.js"
import { installTurnBridge } from "../support/sim-turn.js"

async function openComposer(page: Page, gateway: { entryUrl: string; workspaceId: string }) {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.locator("button.send")).toBeVisible()
}

const field = (page: Page) => page.getByRole("textbox", { name: "Prompt" })

test("输入卡实时渲染 Markdown，提交时发送原文", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("# 标题")
  await expect(prompt.locator("h1")).toHaveText("标题")

  await prompt.press("Shift+Enter")
  await prompt.pressSequentially("- 甲")
  await expect(prompt.locator("ul > li")).toHaveText(["甲"])

  await prompt.press("Enter")
  await expect(prompt.locator("ul > li")).toHaveCount(2)
  await prompt.pressSequentially("乙")
  await expect(prompt.locator("ul > li")).toHaveText(["甲", "乙"])
  expect(bridge.prompts).toEqual([])

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("# 标题\n- 甲\n- 乙")
  await expect(prompt).toHaveText("")
})

test("@ 与 / 在代码块里不弹菜单，普通段落与列表项照旧", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await writeFile(join(complexGateway.workspaceDir, "note.md"), "# note")
  await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)
  const menu = page.getByRole("listbox", { name: "命令菜单" })

  await prompt.click()
  await prompt.pressSequentially("@")
  await expect(menu).toBeVisible()
  await prompt.press("Control+a")
  await prompt.press("Delete")

  await prompt.pressSequentially("```ts")
  await prompt.press("Enter")
  await prompt.pressSequentially("@src/a.ts")
  await expect(menu).toHaveCount(0)
  await expect(prompt.locator("pre code")).toHaveText("@src/a.ts")

  await prompt.press("Enter")
  await prompt.pressSequentially("```")
  await prompt.press("Enter")
  await expect(prompt.locator("pre")).toHaveCount(1)

  await prompt.pressSequentially("- 甲")
  await expect(prompt.locator("ul > li")).toHaveText(["甲"])
  await prompt.press("Enter")
  await prompt.pressSequentially("/")
  await expect(menu).toBeVisible()

  await prompt.press("Escape")
  await prompt.press("Backspace")
  await prompt.pressSequentially("@note")
  await expect(menu.getByRole("option", { name: /note\.md/ })).toBeVisible()
  await prompt.press("Enter")
  await expect(menu).toHaveCount(0)
  await expect(prompt.locator("ul > li")).toHaveCount(2)
  await expect(prompt.locator("ul > li").nth(1).locator("[data-file-mention]")).toHaveText(
    "note.md",
  )
})
