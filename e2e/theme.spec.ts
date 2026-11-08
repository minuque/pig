import { expect, seedWorkspace, test } from "./fixtures.js"

test("半透明窗口开关联动面板背景与窗口底色", async ({ page, gateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  // 记录开关有没有交给桌面壳的材质通道
  await page.addInitScript(() => {
    const calls: boolean[] = []

    ;(window as unknown as { __translucentCalls?: boolean[] }).__translucentCalls = calls
    ;(window as unknown as { pigDesktop?: unknown }).pigDesktop = {
      setThemeColor() {},
      setTranslucent: (on: boolean) => calls.push(on),
    }
  })
  await seedWorkspace(page, gateway.workspaceId)
  await page.goto(gateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })

  await page.locator(".nav-footer").getByRole("button", { name: "设置" }).click()
  // 毛玻璃开关与不透明度拉杆已下线
  await expect(page.getByText("毛玻璃不透明度")).toHaveCount(0)
  await expect(page.getByRole("switch", { name: "毛玻璃" })).toHaveCount(0)

  const root = page.locator(".radix-themes").first()
  const shellBg = () =>
    page.evaluate(() => getComputedStyle(document.querySelector(".shell")!).backgroundColor)

  await expect(root).toHaveAttribute("data-panel-background", "solid")
  expect(await shellBg()).toBe("rgb(247, 247, 248)")

  await page.getByRole("switch", { name: "半透明窗口" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-translucent-window", "on")
  await expect(root).toHaveAttribute("data-panel-background", "translucent")
  expect(await shellBg()).toMatch(/rgba\(|color\(/)

  await page.getByRole("switch", { name: "半透明窗口" }).click()
  await expect(root).toHaveAttribute("data-panel-background", "solid")
  expect(await shellBg()).toBe("rgb(247, 247, 248)")

  expect(
    await page.evaluate(
      () => (window as unknown as { __translucentCalls?: boolean[] }).__translucentCalls,
    ),
  ).toContain(true)
  expect(
    await page.evaluate(
      () => (window as unknown as { __translucentCalls?: boolean[] }).__translucentCalls,
    ),
  ).toContain(false)
})
