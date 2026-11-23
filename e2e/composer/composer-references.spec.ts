import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test } from "../support/fixtures.js"
import {
  COMPLEX_MARKER,
  COMPLEX_SESSION_ID,
  COMPLEX_SESSION_NAME,
} from "../support/prebuild-session.js"
import { installTurnBridge } from "../support/sim-turn.js"

const CONTEXT_MIME = "application/x-pig-context"

async function openComplex(page: Page, gateway: { entryUrl: string; workspaceId: string }) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.getByText(COMPLEX_MARKER, { exact: true })).toBeVisible({ timeout: 30_000 })
}

const field = (page: Page) => page.getByRole("textbox", { name: "Prompt" })

test("文件树里的文件与目录拖到输入卡成为 @ chip，提交原文带路径", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  await mkdir(join(complexGateway.workspaceDir, "src", "nested"), { recursive: true })
  await writeFile(join(complexGateway.workspaceDir, "src", "example.ts"), "export {}\n")
  const bridge = await installTurnBridge(page)

  await openComplex(page, complexGateway)
  await page.getByRole("button", { name: "开关文件面板" }).click()
  const pane = page.getByRole("region", { name: "文件" })
  await pane.locator('.file-tree-row[data-path="src"]').click()

  const prompt = field(page)
  await pane.locator('.file-tree-row[data-path="src/example.ts"]').dragTo(prompt)
  await pane.locator('.file-tree-row[data-path="src/nested"]').dragTo(prompt)

  await expect(prompt.locator(".chip[data-file-mention]")).toHaveText(["example.ts", "nested"])
  await expect(page.locator(".attach-tray .chip")).toHaveCount(0)

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]?.trim()).toBe("@src/example.ts @src/nested")
})

test("复制助手回复的一段，粘到输入卡成为回复引用 chip；切走再回来草稿不丢，提交原文带引用", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComplex(page, complexGateway)
  const paragraph = page.locator(".row-assistant p", { hasText: "已写入时间线" }).last()
  const quote = (await paragraph.textContent())!.trim()
  const copied = await paragraph.evaluate((element, mime) => {
    const selection = document.getSelection()!
    selection.selectAllChildren(element)
    const data = new DataTransfer()

    element.dispatchEvent(
      new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: data }),
    )
    return { plain: data.getData("text/plain"), context: data.getData(mime) }
  }, CONTEXT_MIME)

  expect(copied.plain.trim()).toBe(quote)
  expect(copied.context).toMatch(
    new RegExp(`^\\[.+\\]\\(pig-context://v1/reply/${COMPLEX_SESSION_ID}/[^/?]+\\?text=`),
  )

  const prompt = field(page)
  await prompt.click()
  await prompt.evaluate(
    (element, entries) => {
      const data = new DataTransfer()

      for (const [type, value] of Object.entries(entries)) data.setData(type, value)
      element.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
      )
    },
    { "text/plain": copied.plain, [CONTEXT_MIME]: copied.context },
  )

  const chip = prompt.locator('.chip[data-context-kind="reply"]')
  await expect(chip).toHaveCount(1)
  await expect(chip).toHaveAttribute("title", copied.plain)
  await prompt.pressSequentially("这里展开说说")

  await page.locator(".nav-head").getByRole("button", { name: "新建会话", exact: true }).click()
  await expect(field(page).locator(".chip")).toHaveCount(0)
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(field(page).locator('.chip[data-context-kind="reply"]')).toHaveCount(1)

  await field(page).click()
  await field(page).press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe(`${copied.context} 这里展开说说`)
})
