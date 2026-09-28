import type { Page } from "@playwright/test"

import { waitMs, worstFrameDuring } from "./measure.js"

export type WindowSize = { width: number; height: number }

/** 收起再展开侧栏，量宽度过渡期间的最差帧。收起态按钮宽 0，只能派发点击。 */
export async function sidebarToggleWorst(page: Page): Promise<number> {
  const clickCollapse = () =>
    page.evaluate(() => document.querySelector<HTMLButtonElement>("button.nav-collapse")?.click())
  return await worstFrameDuring(page, async () => {
    await clickCollapse()
    await page.locator(".shell.left-closed").waitFor({ state: "attached" })
    await waitMs(page, 260)
    await clickCollapse()
    await page.locator(".shell.left-closed").waitFor({ state: "detached" })
    await waitMs(page, 260)
  })
}

/** 拖拽分栏把手调宽再调窄，量拖拽期间的最差帧。 */
export async function sidebarDragWorst(page: Page): Promise<number> {
  const resizer = page.locator(".resizer")
  const box = await resizer.boundingBox()

  if (!box) throw new Error("侧栏把手不存在")
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  return await worstFrameDuring(page, async () => {
    await page.mouse.move(x, y)
    await page.mouse.down()

    try {
      for (const delta of [80, -80]) {
        const steps = 6

        for (let step = 1; step <= steps; step += 1) {
          await page.mouse.move(x + (delta * step) / steps, y)
          await waitMs(page, 32)
        }
      }
    } finally {
      await page.mouse.up()
    }
  })
}

/** 窗口改尺寸序列，量 reflow 期间的最差帧，结束恢复原尺寸。 */
export async function windowResizeWorst(
  page: Page,
  size: () => Promise<WindowSize>,
  setSize: (width: number, height: number) => Promise<void>,
): Promise<number> {
  const original = await size()
  return await worstFrameDuring(page, async () => {
    for (const step of [{ width: 1024, height: 700 }, { width: 1440, height: 900 }, original]) {
      await setSize(step.width, step.height)
      await waitMs(page, 200)
    }
  })
}
