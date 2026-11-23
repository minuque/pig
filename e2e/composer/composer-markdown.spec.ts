import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Page } from "@playwright/test"
import { expect, seedWorkspace, test } from "../support/fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "../support/prebuild-session.js"
import { installTurnBridge } from "../support/sim-turn.js"

async function openComposer(page: Page, gateway: { entryUrl: string; workspaceId: string }) {
  await page.emulateMedia({ reducedMotion: "reduce" })
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

test("行内标记与围栏代码块按 Markdown 渲染并原样提交", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("**粗体** 和 `代码`")
  await expect(prompt.locator("strong")).toHaveText("粗体")

  await prompt.press("Shift+Enter")
  await expect(prompt.locator("code")).toHaveText("代码")
  await prompt.pressSequentially("```ts")
  await prompt.press("Enter")
  await prompt.pressSequentially("const a = 1")
  await expect(prompt.locator("pre code")).toHaveText("const a = 1")
  await expect(prompt.locator("pre code")).toHaveClass(/language-ts/)

  await prompt.press("Enter")
  await prompt.pressSequentially("```")
  await prompt.press("Enter")
  await expect(prompt.locator("pre")).toHaveCount(1)
  expect(bridge.prompts).toEqual([])

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]?.trimEnd()).toBe("**粗体** 和 `代码`\n```ts\nconst a = 1\n```")
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
  await prompt.press("Escape")
  await expect(menu).toHaveCount(0)
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

test("项目符号里敲 [ ] 转成任务项，切换勾选后按 Markdown 提交", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)
  const items = prompt.locator("li[data-checked]")

  await prompt.click()
  await prompt.pressSequentially("- [ ] 甲")
  await expect(items).toHaveCount(1)
  await expect(items.first()).toHaveAttribute("data-checked", "false")

  await items.first().locator('input[type="checkbox"]').click()
  await expect(items.first()).toHaveAttribute("data-checked", "true")

  await prompt.press("Enter")
  await prompt.pressSequentially("乙")
  await expect(items).toHaveCount(2)
  await expect(items.nth(1)).toHaveAttribute("data-checked", "false")

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("- [x] 甲\n- [ ] 乙")
})

test("算式里的星号不当强调，按原样提交", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("3 * 4 * 5，再 * 强调 *")
  await expect(prompt.locator("em")).toHaveCount(0)
  await expect(prompt.locator("strong")).toHaveCount(0)

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("3 * 4 * 5，再 * 强调 *")
})

test("输入 1. 与 10. 等有序列表保留可见序号并按多位数拓宽缩进，无序与任务列表正常", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(120_000)
  const bridge = await installTurnBridge(page)

  await openComposer(page, complexGateway)
  const prompt = field(page)

  await prompt.click()
  await prompt.pressSequentially("1. 甲")
  const singleOl = prompt.locator("ol").first()
  const singleLi = singleOl.locator("> li").first()

  await expect(singleLi).toHaveText("甲")
  await expect(singleLi).toHaveAttribute("data-marker", "1.")
  await expect(singleLi).toHaveAttribute("data-marker-width", "2")

  const singleStyle = await singleOl.evaluate((el) => {
    const s = getComputedStyle(el)
    return { listStyleType: s.listStyleType, padding: Number.parseFloat(s.paddingInlineStart) }
  })

  expect(singleStyle.listStyleType).toBe("decimal")
  expect(singleStyle.padding).toBeGreaterThanOrEqual(20)

  await prompt.press("Control+a")
  await prompt.press("Delete")
  await prompt.pressSequentially("100. 百")
  const wideOl = prompt.locator("ol").first()
  const wideLi = wideOl.locator("> li").first()

  await expect(wideLi).toHaveText("百")
  await expect(wideLi).toHaveAttribute("data-marker", "100.")
  await expect(wideLi).toHaveAttribute("data-marker-width", "4")

  const wideStyle = await wideOl.evaluate((el) => {
    const s = getComputedStyle(el)
    return { listStyleType: s.listStyleType, padding: Number.parseFloat(s.paddingInlineStart) }
  })

  expect(wideStyle.listStyleType).toBe("decimal")
  expect(wideStyle.padding).toBeGreaterThan(singleStyle.padding)

  await prompt.press("Control+Enter")
  await expect.poll(() => bridge.prompts.length).toBe(1)
  expect(bridge.prompts[0]).toBe("100. 百")

  await prompt.pressSequentially("- 一")
  await prompt.press("Enter")
  await prompt.pressSequentially("二")
  await prompt.press("Tab")

  const listTypes = await prompt.evaluate((el) => {
    const outer = el.querySelector("ul")!
    const inner = outer.querySelector("ul")!
    return {
      outer: getComputedStyle(outer).listStyleType,
      inner: getComputedStyle(inner).listStyleType,
    }
  })

  expect(listTypes).toEqual({ outer: "disc", inner: "circle" })

  await prompt.press("Control+a")
  await prompt.press("Delete")
  await prompt.pressSequentially("- [ ] 任务")

  const taskType = await prompt
    .locator('ul[data-type="taskList"]')
    .evaluate((el) => getComputedStyle(el).listStyleType)

  expect(taskType).toBe("none")
})
