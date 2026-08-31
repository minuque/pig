import { expect, test } from "./fixtures.js"

const palettes = [
  {
    theme: "light",
    surface: "rgb(252, 252, 251)",
    sidebar: "rgb(251, 251, 249)",
    input: "rgb(254, 254, 254)",
    inputBorder: "rgb(224, 224, 223)",
    ink: "rgb(11, 11, 11)",
    faint: "rgb(137, 135, 129)",
    popover: "rgb(255, 255, 255)",
    popoverBorder: "rgb(215, 215, 213)",
    hover: "rgb(243, 243, 243)",
  },
  {
    theme: "dark",
    surface: "rgb(21, 21, 21)",
    sidebar: "rgb(17, 17, 17)",
    input: "rgb(32, 32, 31)",
    inputBorder: "rgb(49, 49, 49)",
    ink: "rgb(240, 239, 236)",
    faint: "rgb(137, 135, 129)",
    popover: "rgb(32, 32, 31)",
    popoverBorder: "rgb(55, 55, 54)",
    hover: "rgb(41, 41, 41)",
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
    await expect(page.locator("aside.sidebar")).toHaveCSS("background-color", palette.sidebar)
    await expect(page.locator("main")).toHaveCSS("background-color", palette.surface)
    await expect(input).toHaveCSS("background-color", palette.input)
    await expect(input).toHaveCSS("border-top-color", palette.inputBorder)
    await expect(page.locator(".field[contenteditable]")).toHaveCSS("color", palette.ink)
    const placeholder = await page
      .locator(".field[contenteditable]")
      .evaluate((element) => getComputedStyle(element, "::before").color)
    expect(placeholder).toBe(palette.faint)
    await page.locator(".field[contenteditable]").fill("颜色回归测试，不发送")
    await expect(page.locator("button.send")).toBeEnabled()
    await page.getByRole("button", { name: "筛选", exact: true }).click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await expect(menu).toHaveCSS("background-color", palette.popover)
    await expect(menu).toHaveCSS("border-top-color", palette.popoverBorder)
    const menuItem = page.getByRole("menuitem", { name: "项目", exact: true })
    await menuItem.focus()
    await expect(menuItem).toHaveCSS("background-color", palette.hover)
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
    const desktopInput = await page.locator(".glass-shell").evaluate((element) => {
      const style = getComputedStyle(element, "::before")
      return { background: style.backgroundColor, content: style.content, display: style.display }
    })
    expect(desktopInput.background).toBe(palette.input)
    expect(desktopInput.content).toBe('""')
    expect(desktopInput.display).not.toBe("none")
    const desktopBorder = await input.evaluate((element) => {
      const style = getComputedStyle(element, "::after")
      return { color: style.borderTopColor, width: style.borderTopWidth, content: style.content }
    })
    expect(desktopBorder).toEqual({ color: palette.inputBorder, width: "1px", content: '""' })
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
