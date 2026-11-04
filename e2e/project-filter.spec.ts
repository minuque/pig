import { expect, seedWorkspaces, test } from "./fixtures.js"

test("项目筛选支持多选，全部项目恢复全量", async ({ page, multiGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspaces(page, [multiGateway.workspaceId, multiGateway.secondWorkspaceId])
  await page.goto(multiGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  const cards = page.locator(".session-card")

  await expect(cards).toHaveCount(5)

  const head = page.locator(".nav-footer .filter-btn")
  const headClass = await head.getAttribute("class")

  await head.click()

  const menu = page.locator(".scope-menu")

  await expect(menu).toBeVisible()
  await menu.getByText("workspace-a", { exact: true }).click()
  await expect(cards).toHaveCount(3)

  await menu.getByText("workspace-b", { exact: true }).click()
  await expect(cards).toHaveCount(5)

  await menu.getByText("workspace-a", { exact: true }).click()
  await expect(cards).toHaveCount(2)

  await menu.getByText("全部项目", { exact: true }).click()
  await expect(cards).toHaveCount(5)

  // 筛选按钮本身不表达筛选态
  expect(await head.getAttribute("class")).toBe(headClass)
})
