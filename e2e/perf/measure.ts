import type { Browser, BrowserContext, Page } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

import { seedWorkspace } from "../support/fixtures.js"
import {
  armClickStamps,
  clickStamps,
  installPageWaitFor,
  pageDelay,
  waitInPage,
} from "./in-page.js"
import {
  SHORT_SESSION_NAME,
  sessionIdOf,
  sessionPrompt,
  sessionTurns,
  type BenchSessionName,
} from "./seed.js"

export const WORKBENCH_TIMEOUT_MS = 30_000
export const composerInput = (page: Page) => page.locator(".composer .field, .field").first()

function listMoreButton(page: Page) {
  return page.locator("nav.session-list button.more-button", { hasText: "显示更多" })
}

async function expandAllSections(page: Page) {
  const collapsed = page.locator("nav.session-list .section-toggle[aria-expanded=false]")

  for (let step = 0; step < 20; step += 1) {
    if ((await collapsed.count()) === 0) return
    await collapsed.first().click()
  }

  throw new Error("侧栏仍有未展开的分区")
}

async function revealSessionCard(page: Page, name: BenchSessionName) {
  await expandAllSections(page)
  const more = listMoreButton(page)

  for (let step = 0; step < 20; step += 1) {
    if ((await more.count()) === 0) break
    await more.click()
  }

  const window_ = page.locator(".session-window").first()
  await window_.waitFor({ state: "attached", timeout: WORKBENCH_TIMEOUT_MS })
  await window_.evaluate((node) => {
    node.scrollTop = 0
  })

  for (let step = 0; step < 40; step += 1) {
    const found = await window_.evaluate((node, text) => {
      return [...node.querySelectorAll(".session-card")].some((item) =>
        [...item.querySelectorAll("*")].some(
          (el) => el.childNodes.length === 1 && el.textContent === text,
        ),
      )
    }, name)

    if (found) {
      return page.locator(".session-card").filter({ hasText: name }).first()
    }

    const moved = await window_.evaluate((node) => {
      const next = Math.min(
        node.scrollTop + node.clientHeight,
        node.scrollHeight - node.clientHeight,
      )

      if (next === node.scrollTop) return false
      node.scrollTop = next
      return true
    })

    if (!moved) break
  }

  throw new Error(`侧栏找不到会话：${name}`)
}

async function revealAllSessionCards(page: Page) {
  await expandAllSections(page)
  const more = listMoreButton(page)

  for (let step = 0; step < 20; step += 1) {
    if ((await more.count()) === 0) break
    await more.click()
  }

  if ((await more.count()) > 0) throw new Error("侧栏仍有未展开的会话")
  const window_ = page.locator(".session-window")
  await window_.evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await page.waitForFunction(
    () => {
      const node = document.querySelector(".session-window")
      return node && node.scrollTop + node.clientHeight >= node.scrollHeight - 1
    },
    null,
    { timeout: WORKBENCH_TIMEOUT_MS },
  )
}

export async function newBenchContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "zh-CN",
    colorScheme: "light",
    serviceWorkers: "block",
  })
}

/** tsx keepNames 会给函数包 __name，Playwright 把源码 eval 进页面后会找不到。 */
function withNameShim(fn: unknown): unknown {
  if (typeof fn !== "function") return fn
  return new Function(
    "...args",
    `const __name = (f) => f;\nreturn (${fn.toString()}).apply(null, args);`,
  )
}

function shimPageFunctions(page: Page) {
  const evaluate = page.evaluate.bind(page)
  page.evaluate = ((fn: never, arg?: never) =>
    evaluate(withNameShim(fn) as never, arg)) as typeof page.evaluate
  const waitForFunction = page.waitForFunction.bind(page)
  // 被遮住的页面不跑 rAF，waitForFunction 会一直等。计时器驱动才能推进。
  page.waitForFunction = ((fn: never, arg?: never, options?: never) => {
    const merged = {
      ...(typeof options === "object" && options !== null ? options : {}),
      polling: 8,
      timeout: WORKBENCH_TIMEOUT_MS,
    }
    return Promise.race([
      waitForFunction(withNameShim(fn) as never, arg, merged),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("waitForFunction timeout")), merged.timeout),
      ),
    ])
  }) as typeof page.waitForFunction
}

export async function prepareBenchPage(
  page: Page,
  workspaceId: string,
  options?: { reducedMotion?: boolean },
) {
  shimPageFunctions(page)
  await page.emulateMedia({
    reducedMotion: options?.reducedMotion ? "reduce" : "no-preference",
  })
  await seedWorkspace(page, workspaceId)
  await installPageWaitFor(page)

  page.setDefaultTimeout(WORKBENCH_TIMEOUT_MS)
}

export async function captureBenchFailure(page: Page, path: string) {
  await mkdir(dirname(path), { recursive: true })
  await page.screenshot({ path }).catch(() => undefined)
}

export async function waitForWorkbench(page: Page) {
  await waitInPage(page, {
    present: ["nav.session-list", ".composer .field, .field"],
    gone: [".startup-screen"],
    textIn: { selector: ".session-card", text: SHORT_SESSION_NAME },
    clickMore: "nav.session-list button.more-button",
  })
}

/** Composer 按下一键到下一帧的耗时；隐藏页面不跑 rAF，退回到一帧预算。 */
export async function keyToComposerLatency(page: Page): Promise<number> {
  await composerInput(page).click()
  await page.evaluate(() => {
    const slot = window as unknown as { __pigKeyLatency: number | null }
    slot.__pigKeyLatency = null
    const field = document.querySelector(".composer .field, .field")

    if (!field) throw new Error("Composer 不存在")
    field.addEventListener(
      "keydown",
      () => {
        const start = performance.now()
        const settle = () => {
          slot.__pigKeyLatency = performance.now() - start
        }

        // 隐藏页面不出帧，用一帧预算的计时器代替；可见页面量真实的两帧
        if (document.visibilityState === "hidden") setTimeout(settle, 32)
        else requestAnimationFrame(() => requestAnimationFrame(settle))
      },
      { once: true },
    )
  })
  await page.keyboard.press("x")
  await page.waitForFunction(
    () => (window as unknown as { __pigKeyLatency: number | null }).__pigKeyLatency != null,
    null,
    { timeout: 5_000 },
  )
  return page.evaluate(() => (window as unknown as { __pigKeyLatency: number }).__pigKeyLatency)
}

export async function openSession(page: Page, name: BenchSessionName): Promise<number> {
  const turns = sessionTurns(name)
  const card = await revealSessionCard(page, name)
  await armClickStamps(page, card, {
    ready: {
      urlPath: `/sessions/${sessionIdOf(name)}`,
      gone: [".session-loading"],
      ...(turns > 0 ? { rowText: sessionPrompt(name, turns) } : { present: [".idle-hero"] }),
    },
  })
  await card.evaluate((node) => {
    ;(node as HTMLElement).click()
  })
  return clickStamps(page, "ready")
}

type ScrollFrames = { __pigScrollFrames: number[]; __pigScrollStop: () => void }

async function beginFrameSample(page: Page) {
  await page.evaluate(() => {
    const slot = window as unknown as ScrollFrames
    slot.__pigScrollFrames = []
    let last = 0
    let running = true
    slot.__pigScrollStop = () => {
      running = false
    }

    const step = () => {
      const now = performance.now()

      if (last) slot.__pigScrollFrames.push(now - last)
      last = now

      if (running) setTimeout(step, 1)
    }

    // 被遮住的页面不跑 rAF，帧率采样改用计时器
    step()
  })
}

async function endWorstFrameSample(page: Page): Promise<number> {
  const worst = await page.evaluate(() => {
    const slot = window as unknown as ScrollFrames
    slot.__pigScrollStop()
    const frames = slot.__pigScrollFrames.filter((ms) => ms < 1_000)

    if (frames.length === 0) throw new Error("采样期间未采到动画帧")
    return frames.reduce((max, ms) => Math.max(max, ms), 0)
  })

  if (!(worst > 0)) throw new Error("最差帧无效")
  return worst
}

async function worstFrameDuring(page: Page, action: () => Promise<void>): Promise<number> {
  await beginFrameSample(page)

  try {
    await action()
    return await endWorstFrameSample(page)
  } catch (error) {
    await page
      .evaluate(() => (window as unknown as Partial<ScrollFrames>).__pigScrollStop?.())
      .catch(() => undefined)
    throw error
  }
}

async function scrollOverflowWorstFrame(
  page: Page,
  selector: string,
  emptyMessage: string,
): Promise<number> {
  const root = page.locator(selector)
  const box = await root.boundingBox()

  if (!box) throw new Error(emptyMessage)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const distance = await root.evaluate((node) => node.scrollHeight - node.clientHeight)

  if (distance <= 0) throw new Error(emptyMessage)
  return await worstFrameDuring(page, async () => {
    for (const direction of [-1, 1]) {
      for (let step = 0; step < 40; step += 1) {
        const remaining = await root.evaluate((node, dir) => {
          if (dir < 0) return node.scrollTop
          return node.scrollHeight - node.clientHeight - node.scrollTop
        }, direction)

        if (remaining <= 1) break
        await page.mouse.wheel(0, direction * Math.max(1, Math.ceil(remaining / 20)))
        await pageDelay(page, 32)
      }

      await root.evaluate((node, dir) => {
        node.scrollTop = dir < 0 ? 0 : node.scrollHeight
      }, direction)
      await pageDelay(page, 150)
      await root.evaluate((node, dir) => {
        node.scrollTop = dir < 0 ? 0 : node.scrollHeight
      }, direction)
      await page.waitForFunction(
        ({ sel, dir }) => {
          const node = document.querySelector(sel)

          if (!node) return false
          return dir < 0
            ? node.scrollTop <= 1
            : node.scrollHeight - node.clientHeight - node.scrollTop <= 1
        },
        { sel: selector, dir: direction },
      )
    }
  })
}

async function loadAllTranscriptPages(page: Page, pages: number) {
  const more = page.locator(".older-button")
  const root = page.locator(".transcript-viewport")

  for (let pageIndex = 0; pageIndex < pages && (await more.count()) > 0; pageIndex += 1) {
    await page.waitForFunction(() => {
      const button = document.querySelector<HTMLButtonElement>(".older-button")
      return button == null || !button.disabled
    })

    if ((await more.count()) === 0) break
    const previous = await root.evaluate((node) => node.scrollHeight)
    await more.evaluate((node) => {
      if (!(node instanceof HTMLButtonElement) || node.disabled) return
      node.click()
    })
    await page.waitForFunction(
      (height) => {
        const node = document.querySelector(".transcript-viewport")
        const button = document.querySelector<HTMLButtonElement>(".older-button")
        return !!node && (button == null || (!button.disabled && node.scrollHeight > height))
      },
      previous,
      { timeout: WORKBENCH_TIMEOUT_MS },
    )
  }

  if ((await more.count()) > 0) throw new Error("长会话仍有更早历史未加载")
}

async function waitForSettledView(page: Page) {
  await page.waitForFunction(
    () => {
      const win = window as unknown as { __pigQuiet?: { last: number; quiet: number } }
      const now = performance.now()
      const slot = (win.__pigQuiet ??= { last: now, quiet: 0 })
      const busy = now - slot.last >= 24

      slot.last = now
      slot.quiet = busy ? 0 : slot.quiet + 1
      return slot.quiet >= 8
    },
    null,
    { timeout: WORKBENCH_TIMEOUT_MS },
  )
}

async function scrollTranscriptToTop(page: Page) {
  const root = page.locator(".transcript-viewport")
  const box = await root.boundingBox()

  if (!box) throw new Error("主视口不存在")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  for (let step = 0; step < 400; step += 1) {
    const top = await root.evaluate((node) => node.scrollTop)

    if (top <= 0) return
    await page.mouse.wheel(0, -Math.max(400, box.height))
    await pageDelay(page, 16)
  }
}

export async function scrollTranscript(page: Page, name: BenchSessionName): Promise<number> {
  const turns = sessionTurns(name)

  if (turns === 0) throw new Error("空会话没有可滚动历史")
  await loadAllTranscriptPages(page, turns)
  await scrollTranscriptToTop(page)
  await page
    .getByText(sessionPrompt(name, 1), { exact: true })
    .waitFor({ state: "attached", timeout: WORKBENCH_TIMEOUT_MS })
  await waitForSettledView(page)
  return scrollOverflowWorstFrame(page, ".transcript-viewport", "长会话未产生可滚动内容")
}

export async function scrollSessionList(page: Page): Promise<number> {
  await revealAllSessionCards(page)
  return scrollOverflowWorstFrame(page, ".session-window", "侧栏未产生可滚动内容")
}

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new Error("测量样本为空")

  if (
    !Number.isFinite(q) ||
    q < 0 ||
    q > 1 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error("测量样本或分位数无效")
  const sorted = [...values].sort((left, right) => left - right)
  const index = (sorted.length - 1) * q
  const low = Math.floor(index)
  const high = Math.ceil(index)
  const lowValue = sorted[low] ?? 0

  if (low === high) return lowValue
  const highValue = sorted[high] ?? lowValue
  return lowValue + (highValue - lowValue) * (index - low)
}

export function median(values: readonly number[]): number {
  return quantile(values, 0.5)
}

export function p90(values: readonly number[]): number {
  return quantile(values, 0.9)
}
