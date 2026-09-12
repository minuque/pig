import type { Page } from "@playwright/test"

import { nextPaint, openSession, WORKBENCH_TIMEOUT_MS } from "./measure.js"
import type { BenchSessionName } from "./seed.js"

type PageBench = {
  longTasks: { start: number; duration: number }[]
}

type ToolExpandMark = {
  started: number
  firstFrameMs: number
}

type IdleGate = {
  __pigIdleRestore?: () => void
  __pigToolExpand?: ToolExpandMark
}

export type ToolExpandBench = {
  firstFrameMs: number
  completeMs: number
  worstLongTaskMs: number
}

async function holdIdleCallbacks(page: Page) {
  await page.evaluate(() => {
    const slot = window as typeof window & IdleGate
    slot.__pigIdleRestore?.()
    const nativeRequest = window.requestIdleCallback.bind(window)
    const nativeCancel = window.cancelIdleCallback.bind(window)
    const held = new Set<number>()
    let nextHandle = 1_000_000_000
    window.requestIdleCallback = () => {
      const handle = nextHandle
      nextHandle += 1
      held.add(handle)
      return handle
    }
    window.cancelIdleCallback = (handle) => {
      if (!held.delete(handle)) nativeCancel(handle)
    }
    slot.__pigIdleRestore = () => {
      held.clear()
      window.requestIdleCallback = nativeRequest
      window.cancelIdleCallback = nativeCancel
      delete slot.__pigIdleRestore
    }
  })
}

async function restoreIdleCallbacks(page: Page) {
  await page.evaluate(() => {
    const slot = window as typeof window & IdleGate
    slot.__pigIdleRestore?.()
  })
}

/** 禁止后台预挂载后，测历史工具组第一次展开。 */
export async function expandToolSteps(
  page: Page,
  name: BenchSessionName,
  expectedSteps: number,
): Promise<ToolExpandBench> {
  await holdIdleCallbacks(page)
  try {
    await openSession(page, name)
    const summary = page.locator(".row-tools .summary-btn").first()
    await summary.waitFor({ state: "visible", timeout: WORKBENCH_TIMEOUT_MS })
    await summary.evaluate((node) => {
      node.addEventListener(
        "click",
        () => {
          const slot = window as typeof window & IdleGate
          const mark = { started: performance.now(), firstFrameMs: 0 }
          slot.__pigToolExpand = mark
          requestAnimationFrame(() => {
            mark.firstFrameMs = performance.now() - mark.started
          })
        },
        { once: true },
      )
    })
    await summary.click({ force: true, noWaitAfter: true })
    await page.waitForFunction(
      (expected) => document.querySelectorAll(".row-tools .tool-summary").length >= expected,
      expectedSteps,
      { timeout: WORKBENCH_TIMEOUT_MS },
    )
    await page.waitForFunction(
      () => ((window as typeof window & IdleGate).__pigToolExpand?.firstFrameMs ?? 0) > 0,
      null,
      { timeout: WORKBENCH_TIMEOUT_MS },
    )
    await nextPaint(page)
    await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
    return page.evaluate(() => {
      const slot = window as typeof window & IdleGate
      const mark = slot.__pigToolExpand
      const bench = (window as unknown as { __pigBench: PageBench }).__pigBench
      if (!mark) throw new Error("未记录工具步骤展开起点")
      const completeMs = performance.now() - mark.started
      const longTasks = bench.longTasks.filter(
        (task) => task.start >= mark.started && task.start <= performance.now(),
      )
      return {
        firstFrameMs: mark.firstFrameMs,
        completeMs,
        worstLongTaskMs: longTasks.reduce((max, task) => Math.max(max, task.duration), 0),
      }
    })
  } finally {
    await restoreIdleCallbacks(page)
  }
}
