import { expect, seedWorkspace, test } from "../support/fixtures.js"
import { installTurnBridge } from "../support/sim-turn.js"

test("扩展 select：输入卡锁住，方向键移到第二项回车选中，浮板收起后原草稿放回", async ({
  page,
  navGateway,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, navGateway.workspaceId)
  const bridge = await installTurnBridge(page)
  await page.goto(navGateway.entryUrl)
  const card = page.locator(".session-card").first()
  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  const id = new URL(page.url()).pathname.split("/").pop()!
  const prompt = page.getByRole("textbox", { name: "Prompt" })
  await prompt.fill("我的草稿")

  bridge.send({
    type: "event",
    event: {
      type: "extension_ui_request",
      sessionId: id,
      request: {
        id: "pick-1",
        method: "select",
        title: "选一个环境",
        options: ["staging", "prod"],
      },
    },
  })
  const board = page.locator(".question-board")
  await expect(board.getByRole("option", { name: /prod/ })).toBeVisible()
  await expect(prompt).toHaveText("")
  await expect(prompt).toHaveAttribute("contenteditable", "false")
  await expect(page.locator(".composer-stack .field-placeholder")).toHaveText("从上面选一项")

  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(board).toHaveCount(0)
  await expect(prompt).toHaveText("我的草稿")
})

test("agent 提问：两题切题、第二题直接回复，提交后作为一条用户消息发出", async ({
  page,
  navGateway,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, navGateway.workspaceId)
  const bridge = await installTurnBridge(page)
  await page.goto(navGateway.entryUrl)
  const card = page.locator(".session-card").first()
  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await page.getByRole("textbox", { name: "Prompt" }).fill("帮我选日期库")
  await page.locator("button.send").click()
  const id = await bridge.waitForPrompt()

  bridge.send({
    type: "event",
    event: {
      type: "session_progress",
      sessionId: id,
      progress: {
        type: "item_finished",
        item: {
          id: "ask-tool",
          role: "tool",
          toolCallId: "ask-call",
          toolName: "ask_user_question",
          input: {
            questions: [
              {
                header: "库",
                question: "用哪个日期库？",
                options: [
                  { label: "date-fns", description: "按需引入" },
                  { label: "dayjs", description: "体积小" },
                ],
              },
              {
                header: "格式",
                question: "日期怎么显示？",
                options: [
                  { label: "相对时间", description: "3 分钟前" },
                  { label: "绝对时间", description: "2026-11-26" },
                ],
              },
            ],
          },
          content: [{ type: "text", text: "Asked the user 2 question(s)." }],
          timestamp: 1_700_000_000_000,
          status: "complete",
          isError: false,
        },
      },
    },
  })
  const snapshot = bridge.snapshots.get(id)!
  bridge.send({
    type: "event",
    event: {
      type: "session_snapshot",
      snapshot: { ...snapshot, phase: "idle", revision: snapshot.revision + 1 },
    },
  })

  const board = page.locator(".question-board")
  await expect(board.getByText("用哪个日期库？")).toBeVisible()
  await board.getByRole("option", { name: /date-fns/ }).click()
  await expect(board.getByText("日期怎么显示？")).toBeVisible()
  await board.getByRole("button", { name: "上一题" }).click()
  await expect(board.getByRole("option", { name: /date-fns/ })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await board.getByRole("button", { name: "下一题" }).first().click()

  await page.getByRole("textbox", { name: "Prompt" }).fill("按用户时区的短日期")
  await board.getByRole("button", { name: "提交" }).click()

  await expect.poll(() => bridge.prompts.at(-1)).toBe("库：date-fns\n格式：按用户时区的短日期")
  await expect(board).toHaveCount(0)
})
