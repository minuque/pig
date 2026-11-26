import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { Locator, Page } from "@playwright/test"
import { expect, seedWorkspace, test, withGateway } from "../support/fixtures.js"
import { FAUX_MODEL, createReplyRuntime, fauxReply } from "../support/faux-runtime.js"

const field = (page: Page) => page.getByRole("textbox", { name: "Prompt" })

async function selectElementTextByDrag(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded()

  const coords = await target.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)

    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0 || rect.height > 0,
    )
    const first = rects[0] ?? element.getBoundingClientRect()
    const last = rects[rects.length - 1] ?? first
    return {
      startX: first.left + 1,
      startY: first.top + first.height / 2,
      endX: last.right + 8,
      endY: last.top + last.height / 2,
      lastRect: {
        left: last.left,
        top: last.top,
        right: last.right,
        bottom: last.bottom,
      },
    }
  })

  await page.mouse.move(coords.startX, coords.startY)
  await page.mouse.down()
  await page.mouse.move(coords.endX, coords.endY, { steps: 8 })
  await page.mouse.up()
  return coords.lastRect
}

const REF_SESSION_A_ID = "e2e-ref-a"
const REF_SESSION_A_NAME = "源会话 A"
const REF_SESSION_B_ID = "e2e-ref-b"
const REF_SESSION_B_NAME = "目标会话 B"

function seedRefSession(sessionDir: string, cwd: string, id: string, title: string): string {
  const manager = SessionManager.create(cwd, sessionDir, { id })
  const timestamp = Date.now() - 30_000

  manager.appendSessionInfo(title)
  manager.appendModelChange(FAUX_MODEL.provider, FAUX_MODEL.id)
  manager.appendMessage({ role: "user", content: `${title} 初始提问`, timestamp })
  manager.appendMessage({
    role: "assistant",
    content: [{ type: "text", text: `${title} 初始回答` }],
    api: "faux",
    provider: FAUX_MODEL.provider,
    model: FAUX_MODEL.id,
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: timestamp + 1_000,
  })
  const file = manager.getSessionFile()

  if (!file) throw new Error(`预构建引用会话失败: ${id}`)
  return file
}

async function dragSidebarCardTo(page: Page, from: Locator, point: { x: number; y: number }) {
  const start = await from.boundingBox()

  expect(start).not.toBeNull()
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 12 })
  await expect(page.locator(".drag-ghost")).toBeVisible()
  await page.mouse.up()
}

test("刚跑完的回合点引用按钮获真实条目 id，连同会话引用发送后块级卡片与跨会话跳转及刷新都正常", async ({
  page,
}) => {
  test.setTimeout(120_000)
  let sessionFileA = ""

  await withGateway(
    (sessionDir, workspaceDir) => {
      sessionFileA = seedRefSession(sessionDir, workspaceDir, REF_SESSION_A_ID, REF_SESSION_A_NAME)
      seedRefSession(sessionDir, workspaceDir, REF_SESSION_B_ID, REF_SESSION_B_NAME)
    },
    async (gateway) => {
      await seedWorkspace(page, gateway.workspaceId)
      await page.goto(gateway.entryUrl)
      await page
        .locator(".session-card", { has: page.getByText(REF_SESSION_A_NAME, { exact: true }) })
        .click()
      await expect(page).toHaveURL(new RegExp(`/sessions/${REF_SESSION_A_ID}$`))

      const prompt = field(page)
      await prompt.fill("请给出一句测试回复")
      await prompt.press("Control+Enter")

      const initialReply = page.locator(".row-assistant").first().locator("p").first()
      const firstReplyRow = page.locator(".row-assistant").last()
      const firstReply = firstReplyRow.locator("p", { hasText: fauxReply(1) }).last()
      await expect(firstReply).toBeVisible({ timeout: 30_000 })
      await expect(firstReplyRow.locator(".message-stamp")).toBeVisible({ timeout: 30_000 })

      await initialReply.scrollIntoViewIfNeeded()

      const crossCoords = await page.evaluate(
        ([startNode, endNode]) => {
          const r1 = document.createRange()
          r1.selectNodeContents(startNode!)
          const r2 = document.createRange()
          r2.selectNodeContents(endNode!)
          const b1 = r1.getBoundingClientRect()
          const b2 = r2.getBoundingClientRect()
          return {
            startX: b1.left + 1,
            startY: b1.top + b1.height / 2,
            endX: b2.right + 8,
            endY: b2.top + b2.height / 2,
          }
        },
        [await initialReply.elementHandle(), await firstReply.elementHandle()],
      )

      await page.mouse.move(crossCoords.startX, crossCoords.startY)
      await page.mouse.down()
      await page.mouse.move(crossCoords.endX, crossCoords.endY, { steps: 6 })
      await page.mouse.up()
      await expect(page.locator("[data-quote-reply-button]")).toHaveCount(0)

      await page.evaluate(() => window.getSelection()?.removeAllRanges())
      await selectElementTextByDrag(page, firstReply)
      await page.locator("[data-quote-reply-button]").click()
      const popover = page.locator('[data-slot="popover-content"].reply-popover')
      await expect(popover).toBeVisible()
      await popover.locator("textarea").fill("请结合这段继续说明")
      await popover.locator("textarea").press("Enter")
      await expect(popover).toHaveCount(0)

      const composerReplyChip = prompt.locator('.chip[data-context-kind="reply"]')
      await expect(composerReplyChip).toHaveCount(1)
      const refSource = await composerReplyChip.getAttribute("data-context-reference")
      const match = new RegExp(`pig-context://v1/reply/${REF_SESSION_A_ID}/([^/?]+)\\?`).exec(
        refSource ?? "",
      )

      expect(match?.[1]).toBeTruthy()
      expect(match?.[1]).not.toMatch(/^m\d+$/)

      const persistedEntry = SessionManager.open(sessionFileA)
        .getBranch()
        .find(
          (entry) =>
            entry.type === "message" &&
            entry.message.role === "assistant" &&
            entry.message.content.some(
              (block) => block.type === "text" && block.text === fauxReply(1),
            ),
        )

      expect(match?.[1]).toBe(persistedEntry?.id)

      const composerBox = await page.locator(".composer-card").boundingBox()
      expect(composerBox).not.toBeNull()
      await dragSidebarCardTo(
        page,
        page.locator(".session-card", { hasText: REF_SESSION_B_NAME }).first(),
        { x: composerBox!.x + composerBox!.width / 2, y: composerBox!.y - 40 },
      )
      const composerSessionChip = prompt.locator('.chip[data-context-kind="session"]')
      await expect(composerSessionChip).toHaveText(REF_SESSION_B_NAME)
      await expect(composerSessionChip).toHaveAttribute("data-tone", "success")
      await expect(composerSessionChip).not.toHaveAttribute("title")
      await expect(composerSessionChip.locator("svg")).toHaveCount(1)

      await prompt.press("Control+Enter")
      await expect(page.getByText(fauxReply(2), { exact: true })).toBeVisible({ timeout: 30_000 })

      const checkBubble = async () => {
        const bubble = page.locator(".row-user").last()
        const replyCard = bubble.locator('.reply-card[data-context-kind="reply"]')
        const replyComment = bubble.locator(".reply-comment")
        const sessionChip = bubble.locator('.chip[data-context-kind="session"]')

        await expect(replyCard).toHaveCount(1)
        await expect(replyCard).toContainText(fauxReply(1))
        await expect(replyComment).toHaveText("请结合这段继续说明")
        await expect(sessionChip).toHaveText(REF_SESSION_B_NAME)
        await expect(sessionChip).toHaveAttribute("data-tone", "success")
        await expect(sessionChip).not.toHaveAttribute("title")
        await expect(sessionChip.locator("svg")).toHaveCount(1)
        await expect(bubble).not.toContainText("<pig_context")
        await expect(bubble).not.toContainText("pig-context://")
        await expect(bubble).not.toContainText("[Session:")

        await sessionChip.hover()
        await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText(
          REF_SESSION_B_NAME,
        )
      }

      await checkBubble()

      await page.reload()
      await expect(page.getByText(fauxReply(2), { exact: true })).toBeVisible({ timeout: 30_000 })
      await checkBubble()

      await page.locator('.row-user .reply-card[data-context-kind="reply"]').last().click()

      const jumpArticle = page.locator(
        `.row-assistant article[data-entry-id="${persistedEntry!.id}"][data-jump-highlighted="range"]`,
      )

      await expect(jumpArticle).toBeVisible()
      expect(await jumpArticle.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
        "rgba(0, 0, 0, 0)",
      )
      expect(
        await page.evaluate(() => {
          const highlight = CSS.highlights?.get("pig-reply-jump")
          const firstRange = highlight ? [...highlight][0] : undefined
          return firstRange instanceof Range ? firstRange.toString() : ""
        }),
      ).toBe(fauxReply(1))

      await page.locator('.row-user .chip[data-context-kind="session"]').last().click()
      await expect(page).toHaveURL(new RegExp(`/sessions/${REF_SESSION_B_ID}$`))

      await field(page).click()
      await field(page).evaluate((element, source) => {
        const data = new DataTransfer()
        data.setData("text/plain", source)
        element.dispatchEvent(
          new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
        )
      }, refSource!)
      await field(page).locator('.chip[data-context-kind="reply"] .reply-chip-main').click()
      await expect(page).toHaveURL(new RegExp(`/sessions/${REF_SESSION_A_ID}$`))

      const crossJumpArticle = page.locator(
        `.row-assistant article[data-entry-id="${persistedEntry!.id}"][data-jump-highlighted="range"]`,
      )

      await expect(crossJumpArticle).toBeVisible()
      expect(await crossJumpArticle.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
        "rgba(0, 0, 0, 0)",
      )
      expect(
        await page.evaluate(() => {
          const highlight = CSS.highlights?.get("pig-reply-jump")
          const firstRange = highlight ? [...highlight][0] : undefined
          return firstRange instanceof Range ? firstRange.toString() : ""
        }),
      ).toBe(fauxReply(1))
    },
    undefined,
    async (temp) => ({ createRuntime: () => createReplyRuntime(join(temp, "agent")) }),
  )
})
