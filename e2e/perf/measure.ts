import type { Browser, BrowserContext, Page } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

import {
  BENCH_SESSION_TOTAL,
  SHORT_SESSION_NAME,
  sessionIdOf,
  sessionPrompt,
  sessionTurns,
  type BenchSessionName,
} from "./seed.js"

export const WORKBENCH_TIMEOUT_MS = 30_000

type PageBench = {
  fcp: number
  lcp: number
  longTasks: { start: number; duration: number }[]
  interactions: { id: number; duration: number }[]
}

export const composerInput = (page: Page) => page.locator(".composer .field, .field").first()

export function sessionCard(page: Page, name: BenchSessionName) {
  return page.locator(".session-card", { has: page.getByText(name, { exact: true }) })
}

function listMoreButton(page: Page) {
  return page.locator("nav.session-list button.more-button")
}

/** 侧栏折叠时点「显示更多」，直到目标卡片进 DOM。 */
export async function revealSessionCard(page: Page, name: BenchSessionName) {
  const card = sessionCard(page, name)
  const more = listMoreButton(page)

  for (let step = 0; step < 20; step += 1) {
    if ((await card.count()) > 0) return card

    if ((await more.count()) === 0) break
    await more.click()
  }

  return card
}

/** 点完「显示更多」，直到侧栏种子会话全部挂上。 */
export async function revealAllSessionCards(page: Page) {
  const more = listMoreButton(page)

  for (let step = 0; step < 20; step += 1) {
    if ((await more.count()) === 0) break
    await more.click()
  }

  if ((await more.count()) > 0) throw new Error("侧栏仍有未展开的会话")
  await page.waitForFunction(
    (expected) => document.querySelectorAll(".session-card").length >= expected,
    BENCH_SESSION_TOTAL,
    { timeout: WORKBENCH_TIMEOUT_MS },
  )
}

/** 点开会话卡片，不等待后续网络空闲。 */
export async function clickSessionCard(page: Page, name: BenchSessionName) {
  await (await revealSessionCard(page, name)).click({ force: true, noWaitAfter: true })
}

export async function nextPaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
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

/** 注入 FCP / LCP / longtask / Event Timing，须在首次 goto 前调用。 */
export async function installObservers(page: Page) {
  await page.addInitScript({
    content: `window.__pigBench = { fcp: 0, lcp: 0, longTasks: [], interactions: [] };
(function () {
  var bench = window.__pigBench;
  function observe(type, extra, fn) {
    try {
      var po = new PerformanceObserver(function (list) {
        list.getEntries().forEach(fn);
      });
      var opts = Object.assign({ buffered: true }, extra || {});
      try { po.observe(Object.assign({ type: type }, opts)); }
      catch (e) { po.observe({ entryTypes: [type] }); }
    } catch (e) {}
  }
  observe("paint", null, function (entry) {
    if (entry.name === "first-contentful-paint") bench.fcp = entry.startTime;
  });
  observe("largest-contentful-paint", null, function (entry) {
    bench.lcp = entry.startTime;
  });
  observe("longtask", null, function (entry) {
    bench.longTasks.push({ start: entry.startTime, duration: entry.duration });
  });
  observe("event", { durationThreshold: 16 }, function (entry) {
    var duration = entry.duration;
    if (!duration) return;
    var id = entry.interactionId;
    if (id) {
      var prev = bench.interactions.find(function (item) { return item.id === id; });
      if (prev) { if (duration > prev.duration) prev.duration = duration; }
      else bench.interactions.push({ id: id, duration: duration });
    }
  });
})();`,
  })
}

export async function seedWorkspace(page: Page, workspaceId: string) {
  await page.addInitScript(
    ({ id }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([id]))
      localStorage.setItem("pig.lastCwd", id)
      localStorage.setItem("npg-theme", "light")
    },
    { id: workspaceId },
  )
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
  page.waitForFunction = ((fn: never, arg?: never, options?: never) =>
    waitForFunction(withNameShim(fn) as never, arg, options)) as typeof page.waitForFunction
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

  if (observers) await installObservers(page)
  page.setDefaultTimeout(WORKBENCH_TIMEOUT_MS)
}

export async function captureBenchFailure(page: Page, path: string) {
  await mkdir(dirname(path), { recursive: true })
  await page.screenshot({ path }).catch(() => undefined)
}

/** 侧栏列表与 Composer 可用，启动遮罩已离场。 */
export async function waitForWorkbench(page: Page) {
  await page
    .locator("nav.session-list")
    .waitFor({ state: "visible", timeout: WORKBENCH_TIMEOUT_MS })
  await page.waitForFunction(
    () => document.querySelectorAll(".startup-screen").length === 0,
    null,
    {
      timeout: WORKBENCH_TIMEOUT_MS,
    },
  )
  await composerInput(page).waitFor({ state: "visible", timeout: WORKBENCH_TIMEOUT_MS })
  await revealSessionCard(page, SHORT_SESSION_NAME)
  await sessionCard(page, SHORT_SESSION_NAME).waitFor({
    state: "visible",
    timeout: WORKBENCH_TIMEOUT_MS,
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

export async function waitForLatestInViewport(page: Page) {
  await page.waitForFunction(() => {
    const viewport = document.querySelector<HTMLElement>(".transcript-viewport")
    const assistants = document.querySelectorAll<HTMLElement>(".row-assistant")
    const latest = assistants.item(assistants.length - 1)
    const composer = document.querySelector<HTMLTextAreaElement>(".composer .field, .field")

    if (!viewport || !latest || !composer || composer.readOnly || composer.disabled) return false
    const viewportBox = viewport.getBoundingClientRect()
    const latestBox = latest.getBoundingClientRect()
    return latestBox.bottom > viewportBox.top && latestBox.top < viewportBox.bottom
  })
}

export async function readPaint(page: Page): Promise<{ fcp: number; lcp: number; now: number }> {
  await nextPaint(page)
  return page.evaluate(() => {
    const bench = (window as unknown as { __pigBench: PageBench }).__pigBench
    const paints = performance.getEntriesByType("paint")
    const fcpEntry = paints.find((entry) => entry.name === "first-contentful-paint")
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint")
    const lcpFallback = lcpEntries.reduce((max, entry) => Math.max(max, entry.startTime), 0)
    const fcp = bench.fcp || fcpEntry?.startTime || 0
    const lcp = bench.lcp || lcpFallback || 0

    if (!fcp || !lcp) throw new Error("未采集到 FCP/LCP，不能生成启动结果")
    return { fcp, lcp, now: performance.now() }
  })
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
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            slot.__pigK2f = performance.now() - start
          })
        })
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

/** 点侧栏卡片到该会话历史就绪。 */
export async function openSession(page: Page, name: BenchSessionName): Promise<number> {
  const card = await revealSessionCard(page, name)
  await card.evaluate((node) => {
    node.addEventListener("click", () => performance.mark("session-open"), { once: true })
  })
  await clickSessionCard(page, name)
  await waitForSession(page, name)
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve(
              performance.now() - performance.getEntriesByName("session-open").at(-1)!.startTime,
            )
            performance.clearMarks("session-open")
          }),
        )
      }),
  )
}

async function waitMs(page: Page, ms: number) {
  await page.evaluate((delay) => new Promise<void>((resolve) => setTimeout(resolve, delay)), ms)
}

type ScrollFrames = { __pigScrollFrames: number[]; __pigScrollStop: () => void }

async function beginScrollFrames(page: Page) {
  await page.evaluate(() => {
    const slot = window as unknown as ScrollFrames
    slot.__pigScrollFrames = []
    let last = 0
    let running = true
    slot.__pigScrollStop = () => {
      running = false
    }

    const step: FrameRequestCallback[] = [
      (now) => {
        if (last) slot.__pigScrollFrames.push(now - last)
        last = now
        const next = step[0]

        if (running && next) requestAnimationFrame(next)
      },
    ]

    const first = step[0]

    if (!first) throw new Error("滚动帧回调未安装")
    requestAnimationFrame(first)
  })
}

async function endScrollWorstFrame(page: Page): Promise<number> {
  const worst = await page.evaluate(() => {
    const slot = window as unknown as ScrollFrames
    slot.__pigScrollStop()
    const frames = slot.__pigScrollFrames.filter((ms) => ms < 1_000)

    if (frames.length === 0) throw new Error("滚动期间未采到动画帧")
    return frames.reduce((max, ms) => Math.max(max, ms), 0)
  })

  if (!(worst > 0)) throw new Error("滚动最差帧无效")
  return worst
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
  await beginScrollFrames(page)

  try {
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

    return await endScrollWorstFrame(page)
  } catch (error) {
    await page
      .evaluate(() => (window as unknown as Partial<ScrollFrames>).__pigScrollStop?.())
      .catch(() => undefined)
    throw error
  }
}

async function loadAllTranscriptPages(page: Page, name: BenchSessionName, pages: number) {
  const firstPrompt = page.getByText(sessionPrompt(name, 1), { exact: true })
  const more = page.locator(".older-busy")

  for (let pageIndex = 0; pageIndex < pages && (await firstPrompt.count()) === 0; pageIndex += 1) {
    await page.waitForFunction(() => {
      const button = document.querySelector<HTMLButtonElement>(".older-busy")
      return button == null || !button.disabled
    })

    if ((await firstPrompt.count()) > 0 || (await more.count()) === 0) break
    const previous = await page.locator(".row-user").count()
    await page.locator(".transcript-viewport").evaluate((root) => {
      root.scrollTop = 0
      const button = root.querySelector<HTMLButtonElement>(".older-busy")

      if (!button || button.disabled) throw new Error("加载更早不可点")
      button.click()
    })
    await page.waitForFunction(
      (count) => {
        const button = document.querySelector<HTMLButtonElement>(".older-busy")
        return (
          document.querySelectorAll(".row-user").length > count &&
          (button == null || !button.disabled)
        )
      },
      previous,
      { timeout: WORKBENCH_TIMEOUT_MS },
    )
  }

  await firstPrompt.waitFor({ state: "attached", timeout: WORKBENCH_TIMEOUT_MS })
}

/** 分页拉完历史后，时间线滚到顶再到底，返回最差动画帧。 */
export async function scrollTranscript(page: Page, name: BenchSessionName): Promise<number> {
  const turns = sessionTurns(name)

  if (turns === 0) throw new Error("空会话没有可滚动历史")
  await loadAllTranscriptPages(page, name, turns)
  await page.waitForFunction(
    (expected) => document.querySelectorAll(".row-user").length >= expected,
    turns,
    { timeout: WORKBENCH_TIMEOUT_MS },
  )
  return scrollOverflowWorstFrame(page, ".transcript-viewport", "长会话未产生可滚动内容")
}

/** 展开侧栏全部会话后滚到顶再到底，返回最差动画帧。 */
export async function scrollSessionList(page: Page): Promise<number> {
  await revealAllSessionCards(page)
  return scrollOverflowWorstFrame(page, ".nav-body", "侧栏未产生可滚动内容")
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
