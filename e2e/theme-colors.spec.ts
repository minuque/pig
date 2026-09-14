import { expect, test } from "./fixtures.js"

const palettes = [
  {
    theme: "light",
    surface: "rgb(255, 255, 255)",
    sidebar: "rgb(255, 255, 255)",
    input: "rgb(255, 255, 255)",
    inputBorder: "rgb(229, 229, 229)",
    ink: "rgb(10, 10, 10)",
    faint: "rgb(102, 102, 102)",
    popover: "rgb(255, 255, 255)",
    popoverBorder: "rgb(229, 229, 229)",
    hover: "color(srgb 0.0392157 0.0392157 0.0392157 / 0.08)",
  },
  {
    theme: "dark",
    surface: "rgb(18, 18, 18)",
    sidebar: "rgb(23, 23, 23)",
    input: "rgb(38, 38, 38)",
    inputBorder: "rgb(64, 64, 64)",
    ink: "rgb(250, 250, 250)",
    faint: "rgb(163, 163, 163)",
    popover: "rgb(38, 38, 38)",
    popoverBorder: "rgb(64, 64, 64)",
    hover: "color(srgb 0.980392 0.980392 0.980392 / 0.08)",
  },
]

for (const palette of palettes) {
  test(`${palette.theme} theme matches sampled reference colors`, async ({
    page,
    gateway,
  }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.addInitScript(
      ({ workspaceId }) => {
        localStorage.setItem("pig.localWorkspaces", JSON.stringify([workspaceId]))
        localStorage.setItem("pig.lastCwd", workspaceId)

        if (!localStorage.getItem("npg-theme")) localStorage.setItem("npg-theme", "light")
      },
      { workspaceId: gateway.workspaceId },
    )
    await page.goto(gateway.origin)
    await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("正在连接…")).toHaveCount(0)

    if (palette.theme === "dark") await page.locator("button.theme-toggle").click()

    const input = page.locator(".glass-host")
    await expect(page.locator("aside.sidebar")).toHaveCSS("background-color", palette.surface)
    await expect(page.locator(".nav-card")).toHaveCSS("background-color", palette.sidebar)
    await expect(page.locator("main")).toHaveCSS("background-color", palette.surface)
    await expect(input).toHaveCSS("background-color", palette.input)
    await expect(input).toHaveCSS("border-top-color", palette.inputBorder)
    await expect(input).toHaveCSS("border-top-width", "1px")
    await expect(input).toHaveCSS("box-shadow", "none")
    const prompt = page.getByRole("textbox", { name: "Prompt" })
    await expect(prompt).toHaveCSS("color", palette.ink)

    const placeholder = await prompt.evaluate(
      (element) => getComputedStyle(element, "::placeholder").color,
    )

    expect(placeholder).toBe(palette.faint)

    await prompt.fill("颜色回归测试，不发送")
    await expect(page.locator("button.send")).toBeEnabled()
    await expect(input).toHaveCSS("border-top-width", "1px")
    await expect(input).toHaveCSS("box-shadow", "none")
    await page.getByRole("button", { name: /选择模型/ }).click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await expect(menu).toHaveCSS("background-color", palette.popover)
    await expect(menu).toHaveCSS("border-top-color", palette.popoverBorder)
    const rail = menu.locator(".rail-btn").first()
    await rail.hover()
    await expect(rail).toHaveCSS("background-color", palette.hover)
    await page.screenshot({ path: info.outputPath(`${palette.theme}-menu.png`) })
    await page.keyboard.press("Escape")

    const bounds = await input.boundingBox()

    if (!bounds) throw new Error("Input is not painted")

    const fillSample = {
      x: Math.floor(bounds.x + bounds.width / 2),
      y: Math.floor(bounds.y + 8),
      width: 2,
      height: 2,
    }

    const webFill = await page.screenshot({ clip: fillSample, animations: "disabled" })

    await page.evaluate(() => {
      document.documentElement.dataset.pigDesktopPlatform = "win32"
    })
    const desktopFill = await page.screenshot({ clip: fillSample, animations: "disabled" })
    expect(desktopFill.equals(webFill)).toBe(true)
    await page.screenshot({ path: info.outputPath(`${palette.theme}-desktop.png`) })

    await page.reload()
    await expect(input).toHaveCSS("background-color", palette.input)
    const storedTheme = await page.evaluate(() => localStorage.getItem("npg-theme"))
    expect(storedTheme).toBe(palette.theme)
    await page.screenshot({ path: info.outputPath(`${palette.theme}-reloaded.png`) })
  })
}
