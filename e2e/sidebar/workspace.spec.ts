import { expect, test } from "../support/fixtures.js"

test("选目录走真实链路，落到本地偏好", async ({ page, navGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(navGateway.entryUrl)

  await expect(page.locator("h1.hero-title")).toBeVisible({ timeout: 30_000 })
  await expect(page.locator(".hero-picker .hero-name")).toHaveText("workspace")

  expect(await page.evaluate(() => localStorage.getItem("pig.localWorkspaces"))).toBeNull()

  await page.locator(".hero-picker").click()
  await page.getByRole("menuitem", { name: "添加本地目录" }).click()

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("pig.localWorkspaces")))
    .not.toBeNull()

  const stored = await page.evaluate(() => localStorage.getItem("pig.localWorkspaces"))

  expect(JSON.parse(stored ?? "[]")).toEqual([navGateway.workspaceId])
  expect(await page.evaluate(() => localStorage.getItem("pig.lastCwd"))).toBe(
    navGateway.workspaceId,
  )
})
