import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "./prebuild-session.js"
import { installTurnBridge } from "./sim-turn.js"

async function seedWorkspace(page: Page, workspaceId: string) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(
    ({ id }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([id]))
      localStorage.setItem("pig.lastCwd", id)
      localStorage.setItem("npg-theme", "light")
    },
    { id: workspaceId },
  )
}

/** DataTransfer 只能在页面里造，一次派发一个拖拽事件。 */
async function drag(page: Page, type: string, total = 2) {
  await page.locator(".session-panel").evaluate(
    (element, input) => {
      const data = new DataTransfer()

      for (let i = 0; i < input.total; i += 1) {
        const image = i === 1
        const name = image ? "shot.png" : i === 0 ? "note.md" : `f${i}.txt`

        data.items.add(new File(["x"], name, { type: image ? "image/png" : "text/plain" }))
      }

      element.dispatchEvent(new DragEvent(input.type, { bubbles: true, dataTransfer: data }))
    },
    { type, total },
  )
}

test("输入卡附件：拖入出现 chips，移除后消失", async ({ page, gateway }) => {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const panel = page.locator(".session-panel")
  const card = page.locator(".composer-card")
  const note = page.getByRole("button", { name: "移除 note.md" })
  const shot = page.getByRole("button", { name: "移除 shot.png" })

  await expect(panel).toBeVisible()
  await expect(note).toHaveCount(0)
  await expect(card).toHaveCSS("border-radius", "32px")

  await drag(page, "dragenter")
  await expect(panel).toHaveClass(/is-drop-active/)
  await expect(panel.locator(".drop-guide")).toHaveCSS("opacity", "1")
  await expect(panel.getByText("松开鼠标添加附件")).toBeAttached()
  await drag(page, "dragover")
  await drag(page, "drop")
  await expect(panel).not.toHaveClass(/is-drop-active/)
  await expect(panel.locator(".drop-guide")).toHaveCSS("opacity", "0")
  await expect(note).toBeVisible()
  await expect(shot).toBeVisible()
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)
  await expect(card).toHaveCSS("border-radius", "32px")

  await note.click()
  await expect(note).toHaveCount(0)
  await expect(shot).toBeVisible()
  await expect(page.locator(".attach-tray .chip")).toHaveCount(1)

  // 粘贴图片与拖入走同一条附加路径
  await page.getByRole("textbox", { name: "Prompt" }).evaluate((element) => {
    const data = new DataTransfer()

    data.items.add(new File(["x"], "paste.png", { type: "image/png" }))
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: data }))
  })
  await expect(page.getByRole("button", { name: "移除 paste.png" })).toBeVisible()
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)

  // 非白名单图片（svg）没有预览，走文件卡片
  await page.getByRole("textbox", { name: "Prompt" }).evaluate((element) => {
    const data = new DataTransfer()

    data.items.add(new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" }))
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: data }))
  })
  const svg = page.locator(".attach-tray .chip", { hasText: "icon.svg" })

  await expect(svg).toBeVisible()
  await expect(svg.locator("img")).toHaveCount(0)
})

test("输入卡附件：拖出面板关掉染色遮罩", async ({ page, gateway }) => {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const panel = page.locator(".session-panel")

  await drag(page, "dragenter")
  await expect(panel).toHaveClass(/is-drop-active/)
  // 子元素之间的 leave 不该关遮罩
  await panel.evaluate((element) => {
    const inner = element.querySelector(".conversation-column")

    element.dispatchEvent(new DragEvent("dragleave", { bubbles: true, relatedTarget: inner }))
  })
  await expect(panel).toHaveClass(/is-drop-active/)
  // 拖到面板外才关
  await panel.evaluate((element) => {
    element.dispatchEvent(
      new DragEvent("dragleave", { bubbles: true, relatedTarget: document.body }),
    )
  })
  await expect(panel).not.toHaveClass(/is-drop-active/)
  // 拖出窗口时 relatedTarget 为 null
  await drag(page, "dragenter")
  await panel.evaluate((element) => {
    element.dispatchEvent(new DragEvent("dragleave", { bubbles: true }))
  })
  await expect(panel).not.toHaveClass(/is-drop-active/)
})

test("输入卡附件：超量的跳过并提示，附件入口禁用", async ({ page, gateway }) => {
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const attach = page.getByRole("button", { name: "添加附件" })

  await expect(attach).toBeEnabled()
  await drag(page, "drop", 9)
  await expect(page.locator(".attach-tray .chip")).toHaveCount(8)
  await expect(page.locator(".attach-error")).toContainText("f8.txt（最多 8 个附件）")
  await expect(attach).toBeDisabled()
})

test("附件随 Prompt 发送：逐个 stage 后 bind 到 Session", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await seedWorkspace(page, complexGateway.workspaceId)
  await installTurnBridge(page)
  await page.goto(complexGateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await drag(page, "drop")
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)

  const staged = page.waitForResponse((response) => response.url().includes("/attachments/stage"))
  const bound = page.waitForResponse((response) => response.url().includes("/attachments/bind"))

  await page.getByRole("textbox", { name: "Prompt" }).fill("附件一轮")
  await page.locator("button.send").click()

  const stage = await staged
  const bind = await bound
  const batch = new URL(stage.url()).searchParams.get("batch")

  expect(stage.status()).toBe(200)
  expect(stage.url()).toContain("name=note.md")
  expect(bind.status()).toBe(200)
  expect(bind.request().postDataJSON()).toEqual({ sessionId: COMPLEX_SESSION_ID, batch })
  await expect(
    page.locator(".row-user").getByText("附件一轮", { exact: true }).first(),
  ).toBeVisible()
  await expect(page.locator(".attach-tray")).toHaveCount(0)
})

test("发送中被中止：不再 bind，丢弃批次且保留 chips", async ({ page, complexGateway }) => {
  test.setTimeout(120_000)
  await seedWorkspace(page, complexGateway.workspaceId)
  await installTurnBridge(page)
  // 拖慢 stage，让中止稳定落在 stage 与 bind 之间
  await page.route(/\/attachments\/stage/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.continue()
  })
  await page.goto(complexGateway.entryUrl)

  const card = page.locator(".session-card", {
    has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }),
  })

  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await drag(page, "drop")
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)

  const bound: string[] = []

  page.on("request", (request) => {
    if (request.url().includes("/attachments/bind")) bound.push(request.url())
  })
  const staged = page.waitForRequest((request) => request.url().includes("/attachments/stage"))
  const discarded = page.waitForResponse((response) =>
    response.url().includes("/attachments/discard"),
  )

  await page.getByRole("textbox", { name: "Prompt" }).fill("会被中止的一轮")
  await page.locator("button.send").click()
  const stageRequest = await staged

  await page.keyboard.press("Escape")

  const discard = await discarded
  const batch = new URL(stageRequest.url()).searchParams.get("batch")

  expect(discard.status()).toBe(200)
  expect(discard.request().postDataJSON()).toEqual({ batch })
  expect(bound).toEqual([])
  await expect(page.locator(".attach-tray .chip")).toHaveCount(2)
})
