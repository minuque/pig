import type { Page } from "@playwright/test"

import { waitMs, worstFrameDuring } from "./measure.js"

export type WindowSize = { width: number; height: number }

/** 收起再展开侧栏，量宽度过渡期间的最差帧。收起与展开按钮分处侧栏头与主区头，宽 0 时只能派发点击。 */
export async function sidebarToggleWorst(page: Page): Promise<number> {
  const click = (labels: string[]) =>
    page.evaluate((names) => {
      const selector = names.map((name) => `button[aria-label="${name}"]`).join(",")
      document.querySelector<HTMLButtonElement>(selector)?.click()
    }, labels)
  return await worstFrameDuring(page, async () => {
    await click(["收起侧边栏", "Collapse sidebar"])
    await page.locator(".shell.sb-offcanvas").waitFor({ state: "attached" })
    await waitMs(page, 260)
    await click(["打开侧边栏", "Open sidebar"])
    await page.locator(".shell.sb-offcanvas").waitFor({ state: "detached" })
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

/** 窗口 resize 的三档目标：变窄、变宽、恢复原尺寸。 */
export const RESIZE_TARGETS = [
  { key: "shrink", width: 1024, height: 700 },
  { key: "grow", width: 1440, height: 900 },
] as const

/** 逐步采样 resize：每档单独开一段帧采样，返回各步最差帧。 */
export async function windowResizeSteps(
  page: Page,
  size: () => Promise<WindowSize>,
  setSize: (width: number, height: number) => Promise<void>,
): Promise<{ shrink: number; grow: number; restore: number }> {
  const original = await size()
  const measureStep = (width: number, height: number) =>
    worstFrameDuring(page, async () => {
      await setSize(width, height)
      await waitMs(page, 200)
    })
  const [shrinkTarget, growTarget] = RESIZE_TARGETS
  const shrink = await measureStep(shrinkTarget.width, shrinkTarget.height)
  const grow = await measureStep(growTarget.width, growTarget.height)
  const restore = await measureStep(original.width, original.height)
  return { shrink, grow, restore }
}
