import type { Browser, BrowserContext, Page } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

import { seedWorkspace } from "../fixtures.js"
import { armClickStamps, clickStamps, installPageWaitFor, waitInPage } from "./in-page.js"
import { installObservers } from "./paint.js"
import {
  SHORT_SESSION_NAME,
  sessionIdOf,
  sessionPrompt,
  sessionTurns,
  type BenchSessionName,
} from "./seed.js"

export const WORKBENCH_TIMEOUT_MS = 30_000
export const composerInput = (page: Page) => page.locator(".composer .field, .field").first()

export function sessionCard(page: Page, name: BenchSessionName) {
  return page.locator(".session-card", { has: page.getByText(name, { exact: true }) })
}

function listMoreButton(page: Page) {
  return page.locator("nav.session-list button.more-button", { hasText: "显示更多" })
}

/** 侧栏折叠时点「显示更多」，再从顶往下扫虚拟列表，返回窗口里的目标卡片。 */
export async function revealSessionCard(page: Page, name: BenchSessionName) {
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

/** 点开会话卡片，不等待后续网络空闲。隐藏窗口里 Playwright 点击会等可见，改走 DOM。 */
export async function clickSessionCard(page: Page, name: BenchSessionName) {
  const card = await revealSessionCard(page, name)
  await card.evaluate((node) => {
    ;(node as HTMLElement).click()
  })
}

export async function revealAllSessionCards(page: Page) {
  const more = listMoreButton(page)

  for (let step = 0; step < 20; step += 1) {
    if ((await more.count()) === 0) break
    await more.click()
  }

  if ((await more.count()) > 0) throw new Error("侧栏仍有未展开的会话")
  // 虚拟列表只挂窗口里的行，滚到底把剩余的种子会话带出来
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

export async function nextPaint(page: Page) {
  // 被遮住的页面不跑 rAF，等待用计时器
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 32)))
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
  observers = false,
  options?: { reducedMotion?: boolean },
) {
  shimPageFunctions(page)
  await page.emulateMedia({
    reducedMotion: options?.reducedMotion ? "reduce" : "no-preference",
  })
  await seedWorkspace(page, workspaceId)
  await installPageWaitFor(page)

  if (observers) await installObservers(page)
  page.setDefaultTimeout(WORKBENCH_TIMEOUT_MS)
}

export async function captureBenchFailure(page: Page, path: string) {
  await mkdir(dirname(path), { recursive: true })
  await page.screenshot({ path }).catch(() => undefined)
}

/** 侧栏列表与 Composer 可用，启动遮罩已离场。 */
export async function waitForWorkbench(page: Page) {
  await waitInPage(page, {
    present: ["nav.session-list", ".composer .field, .field"],
    gone: [".startup-screen"],
    textIn: { selector: ".session-card", text: SHORT_SESSION_NAME },
    clickMore: "nav.session-list button.more-button",
  })
}

export async function waitForSession(page: Page, name: BenchSessionName) {
  const turns = sessionTurns(name)
  await page.waitForURL(new RegExp(`/sessions/${sessionIdOf(name)}(?:[?#]|$)`), {
    timeout: WORKBENCH_TIMEOUT_MS,
  })

  if (turns === 0) {
    await page.locator(".idle-hero").waitFor({ state: "visible" })
  } else {
    await page.getByText(sessionPrompt(name, turns), { exact: true }).waitFor({
      state: "visible",
      timeout: WORKBENCH_TIMEOUT_MS,
    })
  }

  await page.locator(".session-loading").waitFor({ state: "hidden", timeout: WORKBENCH_TIMEOUT_MS })
}

/** Composer 按下一键到双 rAF。 */
export async function keyToNextFrame(page: Page): Promise<number> {
  await composerInput(page).click()
  await page.evaluate(() => {
    const slot = window as unknown as { __pigK2f: number | null }
    slot.__pigK2f = null
    const field = document.querySelector(".composer .field, .field")

    if (!field) throw new Error("Composer 不存在")
    field.addEventListener(
      "keydown",
      () => {
        const start = performance.now()
        // 被遮住的页面不跑 rAF，两帧改用计时器
        setTimeout(() => {
          slot.__pigK2f = performance.now() - start
        }, 32)
      },
      { once: true },
    )
  })
  await page.keyboard.press("x")
  await page.waitForFunction(
    () => (window as unknown as { __pigK2f: number | null }).__pigK2f != null,
    null,
    { timeout: 5_000 },
  )
  return page.evaluate(() => (window as unknown as { __pigK2f: number }).__pigK2f)
}

/** 遮罩揭开后立刻滚主视口，量最差动画帧。 */
export async function scrollMainAfterOpen(page: Page): Promise<number> {
  // 会话切换时驻留旧画面，取不带 transcript-hold 的那份
  const root = page.locator(".transcript-viewport:not(.transcript-hold)")
  const box = await root.boundingBox()

  if (!box) throw new Error("主视口不存在")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  return await worstFrameDuring(page, async () => {
    for (const direction of [-1, 1]) {
      for (let step = 0; step < 12; step += 1) {
        await page.mouse.wheel(0, direction * 80)
        await waitMs(page, 32)
      }
    }
  })
}

/** 点侧栏卡片到该会话历史就绪。 */
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

export async function waitMs(page: Page, ms: number) {
  await page.evaluate((delay) => new Promise<void>((resolve) => setTimeout(resolve, delay)), ms)
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

/** 采样 action 期间的动画帧，返回最差帧长。 */
export async function worstFrameDuring(page: Page, action: () => Promise<void>): Promise<number> {
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
        await waitMs(page, 32)
      }

      await root.evaluate((node, dir) => {
        node.scrollTop = dir < 0 ? 0 : node.scrollHeight
      }, direction)
      await waitMs(page, 150)
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

/** 点顶上按钮直到服务端没有更早历史；窗口化只挂视口附近的行，按总高增长判断这一页落地。 */
async function loadAllTranscriptPages(page: Page, pages: number) {
  const more = page.locator(".older-busy")
  const root = page.locator(".transcript-viewport:not(.transcript-hold)")

  for (let pageIndex = 0; pageIndex < pages && (await more.count()) > 0; pageIndex += 1) {
    await page.waitForFunction(() => {
      const button = document.querySelector<HTMLButtonElement>(".older-busy")
      return button == null || !button.disabled
    })

    if ((await more.count()) === 0) break
    const previous = await root.evaluate((node) => node.scrollHeight)
    // 顶上按钮进视口会自己上翻；已 disabled 说明这一页已经在飞。
    await more.evaluate((node) => {
      if (!(node instanceof HTMLButtonElement) || node.disabled) return
      node.click()
    })
    await page.waitForFunction(
      (height) => {
        const node = document.querySelector(".transcript-viewport:not(.transcript-hold)")
        const button = document.querySelector<HTMLButtonElement>(".older-busy")
        return !!node && (button == null || (!button.disabled && node.scrollHeight > height))
      },
      previous,
      { timeout: WORKBENCH_TIMEOUT_MS },
    )
  }

  if ((await more.count()) > 0) throw new Error("长会话仍有更早历史未加载")
}

/** 分批渲染收尾前不采样：连续 8 帧帧长都在预算内。 */
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

/** 分页拉完历史后，时间线滚到顶再到底，返回最差动画帧。 */
export async function scrollTranscript(page: Page, name: BenchSessionName): Promise<number> {
  const turns = sessionTurns(name)

  if (turns === 0) throw new Error("空会话没有可滚动历史")
  await loadAllTranscriptPages(page, turns)
  // 窗口化只挂视口附近的行，滚到顶才算最早一轮真的落地
  await page.locator(".transcript-viewport:not(.transcript-hold)").evaluate((node) => {
    node.scrollTop = 0
  })
  await page
    .getByText(sessionPrompt(name, 1), { exact: true })
    .waitFor({ state: "attached", timeout: WORKBENCH_TIMEOUT_MS })
  // 停稳后窗口内的行才补 Markdown；等补齐且安静下来再采样，量的是滚动本身
  await waitForSettledView(page)
  return scrollOverflowWorstFrame(
    page,
    ".transcript-viewport:not(.transcript-hold)",
    "长会话未产生可滚动内容",
  )
}

/** 展开侧栏全部会话后滚到顶再到底，返回最差动画帧。 */
export async function scrollSessionList(page: Page): Promise<number> {
  await revealAllSessionCards(page)
  return scrollOverflowWorstFrame(page, ".session-window", "侧栏未产生可滚动内容")
}

export function quantile(values: readonly number[], q: number): number {
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
