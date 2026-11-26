import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { Locator, Page } from "@playwright/test"
import { expect, seedWorkspace, test, withGateway } from "../support/fixtures.js"
import { FAUX_MODEL, createReplyRuntime, fauxReply } from "../support/faux-runtime.js"
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

test("文件树里的文件与目录「引用到对话」成为 @ chip，带图标与语义色且使用 Tooltip，提交原文带路径", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  await mkdir(join(complexGateway.workspaceDir, "src", "nested"), { recursive: true })
  await writeFile(join(complexGateway.workspaceDir, "src", "example.ts"), "export {}\n")
  const bridge = await installTurnBridge(page)

  await openComplex(page, complexGateway)
  await page.keyboard.press("Control+2")
  const pane = page.getByRole("region", { name: "文件" })
  await pane.locator('.file-tree-row[data-path="src"]').click()

  const prompt = field(page)
  const mentionBoth = async () => {
    for (const path of ["src/example.ts", "src/nested"]) {
      await page.keyboard.press("Control+2")
      await pane.locator(`.file-tree-row[data-path="${path}"]`).click({ button: "right" })
      await page.getByRole("menuitem", { name: "引用到对话" }).click()
      await expect(page.locator('.pane-view[data-view="chat"]')).not.toHaveAttribute("inert")
    }
  }

  await mentionBoth()

  const fileChip = prompt.locator('.chip[data-file-mention="src/example.ts"]')
  const dirChip = prompt.locator('.chip[data-file-mention="src/nested"]')

  await expect(prompt.locator(".chip[data-file-mention]")).toHaveText(["example.ts", "nested"])
  await expect(fileChip).toHaveAttribute("data-tone", "info")
  await expect(dirChip).toHaveAttribute("data-tone", "info")
  await expect(fileChip).not.toHaveAttribute("title")
  await expect(dirChip).not.toHaveAttribute("title")
  await expect(fileChip.locator("svg")).toHaveCount(1)
  await expect(dirChip.locator("svg")).toHaveCount(1)
  await expect(page.locator(".attach-tray .chip")).toHaveCount(0)

  await fileChip.hover()
  await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText(
    "src/example.ts",
  )

  await prompt.pressSequentially("/clear")
  await prompt.press("Escape")
  await prompt.press("Control+a")
  await prompt.press("Delete")
  await prompt.evaluate((element) => {
    const data = new DataTransfer()
    data.setData("text/plain", "/clear ")
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
    )
  })
  const cmdChip = prompt.locator('.chip[data-command-chip="clear"]')
  await expect(cmdChip).toHaveAttribute("data-tone", "accent")
  await expect(cmdChip).not.toHaveAttribute("title")
  await expect(cmdChip.locator("svg")).toHaveCount(1)
  await cmdChip.hover()
  await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText("/clear")

  await prompt.press("Control+a")
  await prompt.press("Delete")
  await mentionBoth()
  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]?.trim()).toBe("@src/example.ts @src/nested")
})

test("复制助手回复保留纯文本；划词在选区右下角实时显示引用按钮并在弹层编写评论、支持取消撤回与二次编辑", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComplex(page, complexGateway)
  const assistantRow = page.locator(".row-assistant").last()
  const paragraph = assistantRow.locator("p", { hasText: "已写入时间线" }).last()
  const quote = (await paragraph.textContent())!.trim()
  const copied = await paragraph.evaluate((element, mime) => {
    const selection = document.getSelection()!
    selection.selectAllChildren(element)
    const data = new DataTransfer()
    const event = new ClipboardEvent("copy", {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    })
    const dispatched = element.dispatchEvent(event)
    return {
      intercepted: !dispatched || event.defaultPrevented,
      selectedText: selection.toString(),
      context: data.getData(mime),
      types: Array.from(data.types),
    }
  }, CONTEXT_MIME)

  expect(copied.intercepted).toBe(false)
  expect(copied.selectedText.trim()).toBe(quote)
  expect(copied.context).toBe("")
  expect(copied.types).not.toContain(CONTEXT_MIME)

  const prompt = field(page)
  await prompt.click()
  await prompt.evaluate((element, plain) => {
    const data = new DataTransfer()
    data.setData("text/plain", plain)
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
    )
  }, copied.selectedText)
  await expect(prompt).toContainText(quote)
  await expect(prompt.locator('.chip[data-context-kind="reply"]')).toHaveCount(0)
  await prompt.press("Control+a")
  await prompt.press("Delete")

  await page.evaluate(() => window.getSelection()?.removeAllRanges())
  await expect(page.locator("[data-quote-reply-button]")).toHaveCount(0)

  const selectionRect = await selectElementTextByDrag(page, paragraph)
  const quoteButton = page.locator("[data-quote-reply-button]")
  await expect(quoteButton).toBeVisible()
  const buttonBox = await quoteButton.boundingBox()
  expect(buttonBox).not.toBeNull()
  expect(Math.abs(buttonBox!.x - selectionRect.right)).toBeLessThan(24)
  expect(buttonBox!.y).toBeGreaterThanOrEqual(selectionRect.bottom - 2)
  expect(buttonBox!.y).toBeLessThanOrEqual(selectionRect.bottom + 24)

  await quoteButton.click()
  await expect(quoteButton).toHaveCount(0)

  const popover = page.locator('[data-slot="popover-content"].reply-popover')
  await expect(popover).toBeVisible()
  const popoverBox = await popover.boundingBox()
  expect(popoverBox).not.toBeNull()
  expect(popoverBox!.y).toBeGreaterThanOrEqual(selectionRect.bottom - 2)
  expect(popoverBox!.y).toBeLessThanOrEqual(selectionRect.bottom + 40)
  await expect(prompt.locator('.chip[data-context-kind="reply"]')).toHaveCount(1)

  await popover.locator("textarea").press("Escape")
  await expect(popover).toHaveCount(0)
  await expect(prompt.locator('.chip[data-context-kind="reply"]')).toHaveCount(0)

  await selectElementTextByDrag(page, paragraph)
  await expect(quoteButton).toBeVisible()
  await quoteButton.click()
  await expect(popover).toBeVisible()
  await expect(popover).toContainText(quote)

  const commentInput = popover.locator("textarea")
  await commentInput.fill("第一版评论")
  await commentInput.press("Enter")
  await expect(popover).toHaveCount(0)

  const replyChip = prompt.locator('.chip[data-context-kind="reply"]')
  await expect(replyChip).toHaveCount(1)
  await expect(replyChip).toHaveAttribute("data-tone", "warning")
  await expect(replyChip).not.toHaveAttribute("title")
  await expect(replyChip).toContainText("第一版评论")
  await expect(replyChip.locator("svg")).toHaveCount(2)

  await replyChip.hover()
  const hoverCard = page.locator('[data-slot="hover-card-content"][data-open]')
  await expect(hoverCard).toContainText(quote)
  await expect(hoverCard).toContainText("第一版评论")

  await replyChip.locator("[data-reply-edit-trigger]").click()
  await expect(popover).toBeVisible()
  await popover.locator("textarea").fill("未确认的修改")
  await popover.locator("textarea").press("Escape")
  await expect(popover).toHaveCount(0)
  await expect(replyChip).toContainText("第一版评论")

  await replyChip.locator("[data-reply-edit-trigger]").click()
  await expect(popover).toBeVisible()
  await popover.locator("textarea").fill("点击外部自动保存")
  await page.locator(".composer-card .footer").click()
  await expect(popover).toHaveCount(0)
  await expect(replyChip).toContainText("点击外部自动保存")

  await page.locator(".nav-head").getByRole("button", { name: "新建会话", exact: true }).click()
  await expect(field(page).locator(".chip")).toHaveCount(0)
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(field(page).locator('.chip[data-context-kind="reply"]')).toContainText(
    "点击外部自动保存",
  )

  await field(page).locator('.chip[data-context-kind="reply"] [data-reply-edit-trigger]').click()
  await expect(popover).toBeVisible()
  await popover.locator("textarea").fill("直接发送的评论")
  await popover.locator("textarea").press("Control+Enter")

  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toContain("pig-context://v1/reply/")
  expect(bridge.prompts[0]).toContain("comment=")

  const replyCard = page.locator('.row-user .reply-card[data-context-kind="reply"]').last()
  await expect(replyCard).toBeVisible()
  await expect(replyCard).toContainText(quote)
  await expect(page.locator(".row-user .reply-comment").last()).toHaveText("直接发送的评论")
  await replyCard.hover()
  await expect(page.locator('[data-slot="hover-card-content"][data-open]')).toHaveCount(0)
})

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
      await page.emulateMedia({ reducedMotion: "reduce" })
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
