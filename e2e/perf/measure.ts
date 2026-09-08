import type { Page } from "@playwright/test"

import { SHORT_SESSION_NAME, sessionPrompt } from "./seed.js"

export const WORKBENCH_TIMEOUT_MS = 30_000

type LongTask = { start: number; duration: number }

type PageBench = {
  fcp: number
  lcp: number
  longTasks: LongTask[]
  interactions: { id: number | string; duration: number }[]
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
    } else {
      bench.interactions.push({ id: "evt-" + entry.startTime, duration: duration });
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

const composerField = (page: Page) => page.locator(".composer .field, .field").first()

/** 侧栏列表与 Composer 可用，启动遮罩已离场。 */
export async function waitForWorkbench(page: Page) {
  await page
    .locator("nav.session-list")
    .waitFor({ state: "visible", timeout: WORKBENCH_TIMEOUT_MS })
  await page.locator(".startup-screen").waitFor({ state: "hidden", timeout: WORKBENCH_TIMEOUT_MS })
  await composerField(page).waitFor({ state: "visible", timeout: WORKBENCH_TIMEOUT_MS })
  await page.locator(".session-card .title", { hasText: SHORT_SESSION_NAME }).waitFor({
    state: "visible",
    timeout: WORKBENCH_TIMEOUT_MS,
  })
}

export async function waitForSession(page: Page, name: string) {
  await page.getByText(sessionPrompt(name), { exact: true }).waitFor({
    state: "visible",
    timeout: WORKBENCH_TIMEOUT_MS,
  })
  await page.locator(".session-loading").waitFor({ state: "hidden", timeout: WORKBENCH_TIMEOUT_MS })
}

export async function readPaint(page: Page): Promise<{ fcp: number; lcp: number; now: number }> {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))
      }),
  )
  return page.evaluate(() => {
    const bench = (window as unknown as { __pigBench: PageBench }).__pigBench
    const paints = performance.getEntriesByType("paint")
    const fcpEntry = paints.find((entry) => entry.name === "first-contentful-paint")
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint")
    const lcpFallback = lcpEntries.reduce((max, entry) => Math.max(max, entry.startTime), 0)
    const fcp = bench.fcp || fcpEntry?.startTime || 0
    const lcp = bench.lcp || lcpFallback || fcp
    return { fcp, lcp, now: performance.now() }
  })
}

export async function readLongTasks(page: Page): Promise<LongTask[]> {
  return page.evaluate(() => {
    const bench = (window as unknown as { __pigBench: PageBench }).__pigBench
    return bench.longTasks.map((task) => ({ start: task.start, duration: task.duration }))
  })
}

export async function resetLongTasks(page: Page) {
  await page.evaluate(() => {
    ;(window as unknown as { __pigBench: PageBench }).__pigBench.longTasks.length = 0
  })
}

export async function readInpSamples(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const bench = (window as unknown as { __pigBench: PageBench }).__pigBench
    return bench.interactions.map((item) => item.duration)
  })
}

/** FCP 到工作台可用之间，超过 50ms 的长任务计入 TBT。 */
export function totalBlockingTime(tasks: readonly LongTask[], fcp: number, end: number): number {
  let total = 0
  for (const task of tasks) {
    const taskEnd = task.start + task.duration
    if (taskEnd < fcp || task.start > end) continue
    const blocked = task.duration - 50
    if (blocked > 0) total += blocked
  }
  return total
}

export async function keyToNextFrame(page: Page): Promise<number> {
  await composerField(page).click()
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

export async function openSession(page: Page, name: string): Promise<number> {
  const started = await page.evaluate(() => performance.now())
  await page.locator(".session-card", { has: page.locator(".title", { hasText: name }) }).click()
  await waitForSession(page, name)
  const ended = await page.evaluate(() => performance.now())
  return ended - started
}

export async function scrollTranscript(page: Page): Promise<{ count: number; worst: number }> {
  await resetLongTasks(page)
  await page.locator(".transcript-viewport").evaluate((node) => {
    node.scrollTop = 0
  })
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))),
  )
  await page.locator(".transcript-viewport").evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))
      }),
  )
  const tasks = await readLongTasks(page)
  let worst = 0
  for (const task of tasks) if (task.duration > worst) worst = task.duration
  return { count: tasks.length, worst }
}

export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0
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

/** 交互少于 50 次时 INP 取最差；否则取 p98。 */
export function inpValue(samples: readonly number[]): number | null {
  if (samples.length === 0) return null
  if (samples.length < 50) return Math.max(...samples)
  return quantile(samples, 0.98)
}
