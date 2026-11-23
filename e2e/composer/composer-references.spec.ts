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

  const bubbleChip = page.locator('.row-user .chip[data-context-kind="reply"]').last()
  await expect(bubbleChip).toBeVisible()
  await bubbleChip.hover()
  await expect(page.locator('[data-slot="hover-card-content"]')).toContainText(copied.plain)
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

async function copyElementWithContext(element: Locator) {
  return element.evaluate((node, mime) => {
    const selection = document.getSelection()!
    selection.selectAllChildren(node)
    const data = new DataTransfer()

    node.dispatchEvent(
      new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: data }),
    )
    return { plain: data.getData("text/plain"), context: data.getData(mime) }
  }, CONTEXT_MIME)
}

async function pasteWithContext(element: Locator, plain: string, context: string) {
  await element.click()
  await element.evaluate(
    (node, entries) => {
      const data = new DataTransfer()

      for (const [type, value] of Object.entries(entries)) data.setData(type, value)
      node.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
      )
    },
    { "text/plain": plain, [CONTEXT_MIME]: context },
  )
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

test("刚跑完的回合直接复制回复引用获真实条目 id，连同会话引用发送并在气泡与刷新后可悬停/跳转", async ({
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

      const firstReply = page.locator(".row-assistant p", { hasText: fauxReply(1) }).last()
      await expect(firstReply).toBeVisible({ timeout: 30_000 })
      await expect(page.locator(".row-assistant").last().locator(".message-stamp")).toBeVisible({
        timeout: 30_000,
      })

      const copied = await copyElementWithContext(firstReply)
      const match = new RegExp(`pig-context://v1/reply/${REF_SESSION_A_ID}/([^/?]+)\\?`).exec(
        copied.context,
      )

      expect(copied.plain.trim()).toBe(fauxReply(1))
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

      await pasteWithContext(prompt, copied.plain, copied.context)
      await expect(prompt.locator('.chip[data-context-kind="reply"]')).toHaveCount(1)

      const composerBox = await page.locator(".composer-card").boundingBox()
      expect(composerBox).not.toBeNull()
      await dragSidebarCardTo(
        page,
        page.locator(".session-card", { hasText: REF_SESSION_B_NAME }).first(),
        { x: composerBox!.x + composerBox!.width / 2, y: composerBox!.y - 40 },
      )
      await expect(prompt.locator('.chip[data-context-kind="session"]')).toHaveText(
        REF_SESSION_B_NAME,
      )

      await prompt.pressSequentially("请结合这两处回答")
      await prompt.press("Control+Enter")
      await expect(page.getByText(fauxReply(2), { exact: true })).toBeVisible({ timeout: 30_000 })

      const checkBubble = async () => {
        const bubble = page.locator(".row-user").last()
        const replyChip = bubble.locator('.chip[data-context-kind="reply"]')
        const sessionChip = bubble.locator('.chip[data-context-kind="session"]')

        await expect(replyChip).toHaveCount(1)
        await expect(sessionChip).toHaveText(REF_SESSION_B_NAME)
        await expect(bubble).not.toContainText("<pig_context")
        await expect(bubble).not.toContainText("pig-context://")
        await expect(bubble).not.toContainText("[Session:")

        await replyChip.hover()
        await expect(page.locator('[data-slot="hover-card-content"]')).toContainText(fauxReply(1))
      }

      await checkBubble()

      await page.reload()
      await expect(page.getByText(fauxReply(2), { exact: true })).toBeVisible({ timeout: 30_000 })
      await checkBubble()

      await page.locator('.row-user .chip[data-context-kind="session"]').last().click()
      await expect(page).toHaveURL(new RegExp(`/sessions/${REF_SESSION_B_ID}$`))
    },
    undefined,
    async (temp) => ({ createRuntime: () => createReplyRuntime(join(temp, "agent")) }),
  )
})
