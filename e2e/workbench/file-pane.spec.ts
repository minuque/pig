import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Page } from "@playwright/test"

import { checkpoint } from "../support/checkpoint.js"
import { expect, seedWorkspace, test } from "../support/fixtures.js"
import {
  COMPLEX_MARKER,
  COMPLEX_SESSION_ID,
  COMPLEX_SESSION_NAME,
} from "../support/prebuild-session.js"

const SOURCE = "export const fromWorkspace = 42\n"

async function showView(page: Page, name: string) {
  const island = page.locator(".view-island")
  await island.hover()
  await island.getByRole("tab", { name }).click()
}

test("点工具行里的文件名，Files 面板打开这个文件并标出读过的行", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(90_000)
  await mkdir(join(complexGateway.workspaceDir, "src"), { recursive: true })
  await writeFile(join(complexGateway.workspaceDir, "src", "example.ts"), SOURCE)
  await seedWorkspace(page, complexGateway.workspaceId)
  await page.goto(complexGateway.entryUrl)

  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.getByText(COMPLEX_MARKER, { exact: true })).toBeVisible({ timeout: 30_000 })

  const tools = page.locator(".row-tools").last()
  const target = tools.locator(".tool-row-target.is-openable", { hasText: "example.ts" })

  if (!(await target.isVisible())) await tools.locator("button").first().click()
  await target.click()

  const pane = page.getByRole("region", { name: "文件" })

  await expect(pane).toBeVisible()
  await expect(pane.getByRole("tab", { name: "example.ts" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(pane.locator(".file-code-line[data-hl]").first()).toContainText(
    "export const fromWorkspace = 42",
  )
  await expect(
    pane.locator('.file-tree-row[data-active][data-path="src/example.ts"]'),
  ).toBeVisible()
  await checkpoint(page, "file-pane-open")

  await showView(page, "对话")
  await expect(pane).not.toBeInViewport()
  await expect(target).toBeInViewport()
  await page.keyboard.press("Control+2")
  await expect(pane.getByRole("tab", { name: "example.ts" })).toBeInViewport()
  await page.keyboard.press("Control+ArrowLeft")
  await expect(target).toBeInViewport()
})

test("从头部打开 Files，在树里展开目录、搜索内容并跳到命中的行", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(90_000)
  await mkdir(join(complexGateway.workspaceDir, "src"), { recursive: true })
  await writeFile(join(complexGateway.workspaceDir, "src", "example.ts"), SOURCE)
  await writeFile(join(complexGateway.workspaceDir, "notes.md"), "# 笔记\n\nneedle-in-notes\n")
  await seedWorkspace(page, complexGateway.workspaceId)
  await page.goto(complexGateway.entryUrl)
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page.getByText(COMPLEX_MARKER, { exact: true })).toBeVisible({ timeout: 30_000 })

  await showView(page, "文件")
  const pane = page.getByRole("region", { name: "文件" })
  const tree = pane.getByRole("tree")
  const headerBox = (await page.locator(".workbench-header").boundingBox())!
  const mainBox = (await page.locator(".shell main").boundingBox())!
  expect(headerBox.x + headerBox.width).toBeCloseTo(mainBox.x + mainBox.width, 0)
  expect((await pane.boundingBox())!.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height)

  await tree.getByRole("treeitem", { name: "src" }).click()
  await tree.getByRole("treeitem", { name: "example.ts" }).click()
  await expect(pane.getByRole("tab", { name: "example.ts" })).toHaveAttribute(
    "aria-selected",
    "true",
  )

  await pane.getByRole("textbox", { name: "搜索文件" }).fill("needle-in")
  const hit = pane.getByRole("button", { name: /notes\.md:3/ })

  await expect(hit).toBeVisible()
  await hit.click()
  await expect(pane.getByRole("tab", { name: "notes.md" })).toHaveAttribute("aria-selected", "true")
  await expect(pane.getByRole("tab", { name: "example.ts" })).toHaveCount(0)
  await expect(pane.locator(".file-code-line[data-hl]")).toContainText("needle-in-notes")
  await checkpoint(page, "file-pane-search")
})

test("HTML 在沙箱里跑脚本、加载同目录资源，外链先确认；PDF 用浏览器查看器打开", async ({
  page,
  complexGateway,
}) => {
  test.setTimeout(90_000)
  const site = join(complexGateway.workspaceDir, "site")
  await mkdir(site, { recursive: true })
  await writeFile(
    join(site, "index.html"),
    '<html><head><script src="app.js"></script></head><body><p id="out">waiting</p><a id="ext" href="https://example.com/docs">外链</a></body></html>',
  )
  await writeFile(
    join(site, "app.js"),
    `addEventListener("DOMContentLoaded", () => {
      let cookie = "blocked"
      try { cookie = document.cookie } catch {}
      document.getElementById("out").textContent = "脚本已运行:" + String(cookie === "" || cookie === "blocked")
    })`,
  )
  await writeFile(join(complexGateway.workspaceDir, "doc.pdf"), "%PDF-1.4\n%%EOF\n")
  await seedWorkspace(page, complexGateway.workspaceId)
  await page.goto(complexGateway.entryUrl)
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page.getByText(COMPLEX_MARKER, { exact: true })).toBeVisible({ timeout: 30_000 })

  await showView(page, "文件")
  const pane = page.getByRole("region", { name: "文件" })
  const tree = pane.getByRole("tree")

  await tree.getByRole("treeitem", { name: "site" }).click()
  await tree.getByRole("treeitem", { name: "index.html" }).click()

  const frame = pane.frameLocator("iframe.file-html")

  await expect(frame.locator("#out")).toHaveText("脚本已运行:true")
  await frame.locator("#ext").click()
  await expect(page.getByRole("alertdialog")).toContainText("https://example.com/docs")
  await page.getByRole("button", { name: "取消" }).click()
  await checkpoint(page, "file-pane-html")

  await tree.getByRole("treeitem", { name: "doc.pdf" }).click()
  await expect(pane.locator("iframe.file-viewer-pdf")).toHaveAttribute("src", /fs\/raw\?.*doc\.pdf/)
})

test("横滑和 Ctrl+←/→ 切到 Files 再回来，对话的滚动位置不变", async ({ page, complexGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, complexGateway.workspaceId)
  await page.goto(complexGateway.entryUrl)
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page.getByText(COMPLEX_MARKER, { exact: true })).toBeVisible({ timeout: 30_000 })

  const viewport = page.locator('.pane-view[data-view="chat"] .transcript-viewport')
  await viewport.hover()
  await page.mouse.wheel(0, -900)
  const before = await viewport.evaluate((el) => el.scrollTop)
  expect(before).toBeGreaterThan(0)
  const files = page.locator('.pane-view[data-view="files"]')

  await page.locator(".island").click()
  await page.keyboard.press("Control+ArrowRight")
  await expect(files).not.toHaveAttribute("inert")
  await page.keyboard.press("Control+ArrowLeft")
  await expect(files).toHaveAttribute("inert", "")
  expect(await viewport.evaluate((el) => el.scrollTop)).toBe(before)

  const box = (await viewport.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(200, 0)
  await expect(files).not.toHaveAttribute("inert")
  await page.waitForTimeout(400)
  await page.mouse.wheel(-200, 0)
  await expect(files).toHaveAttribute("inert", "")
  expect(await viewport.evaluate((el) => el.scrollTop)).toBe(before)
})
