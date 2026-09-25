import type { Page } from "@playwright/test"

async function nextPaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

export type PageBench = {
  ttfb: number
  fcp: number
  lcp: number
  cls: number
  longTasks: { start: number; duration: number }[]
  interactions: { id: number; duration: number }[]
}

type StartVitals = { ttfb: number; fcp: number; lcp: number; cls: number }

type OpenVitals = { cls: number; inp: number }

/** 注入 TTFB / FCP / LCP / CLS / INP / longtask，须在首次 goto 前调用。 */
export async function installObservers(page: Page) {
  await page.addInitScript({
    content: `window.__pigBench = { ttfb: 0, fcp: 0, lcp: 0, cls: 0, longTasks: [], interactions: [] };
(function () {
  var bench = window.__pigBench;
  var clsBest = 0, clsWindow = 0, clsWindowStart = 0, clsLast = 0;
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
  observe("navigation", null, function (entry) {
    if (entry.responseStart) bench.ttfb = entry.responseStart;
  });
  observe("paint", null, function (entry) {
    if (entry.name === "first-contentful-paint") bench.fcp = entry.startTime;
  });
  observe("largest-contentful-paint", null, function (entry) {
    bench.lcp = entry.startTime;
  });
  observe("layout-shift", null, function (entry) {
    if (entry.hadRecentInput) return;
    var at = entry.startTime;
    if (at - clsLast > 1000 || at - clsWindowStart > 5000) {
      clsWindowStart = at;
      clsWindow = 0;
    }
    clsLast = at;
    clsWindow += entry.value;
    if (clsWindow > clsBest) clsBest = clsWindow;
    bench.cls = clsBest;
  });
  observe("longtask", null, function (entry) {
    bench.longTasks.push({ start: entry.startTime, duration: entry.duration });
  });
  observe("event", { durationThreshold: 16 }, function (entry) {
    var duration = entry.duration;
    if (!duration) return;
    var id = entry.interactionId;
    if (!id) return;
    var prev = bench.interactions.find(function (item) { return item.id === id; });
    if (prev) { if (duration > prev.duration) prev.duration = duration; }
    else bench.interactions.push({ id: id, duration: duration });
  });
})();`,
  })
}

function readBench(page: Page) {
  return page.evaluate(() => {
    const bench = (window as unknown as { __pigBench: PageBench }).__pigBench
    const nav = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined
    const paints = performance.getEntriesByType("paint")
    const fcpEntry = paints.find((entry) => entry.name === "first-contentful-paint")
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint")
    const lcpFallback = lcpEntries.reduce((max, entry) => Math.max(max, entry.startTime), 0)
    const ttfb = bench.ttfb || nav?.responseStart || 0
    const fcp = bench.fcp || fcpEntry?.startTime || 0
    const lcp = bench.lcp || lcpFallback || 0
    const inp = bench.interactions.reduce((max, item) => Math.max(max, item.duration), 0)
    return { ttfb, fcp, lcp, cls: bench.cls, inp }
  })
}

/** 工作台就绪时读导航期 TTFB / FCP / LCP / CLS。 */
export async function readStartVitals(page: Page): Promise<StartVitals> {
  await nextPaint(page)
  const vitals = await readBench(page)

  if (!vitals.fcp || !vitals.lcp) throw new Error("未采集到 FCP/LCP，不能生成启动结果")
  return { ttfb: vitals.ttfb, fcp: vitals.fcp, lcp: vitals.lcp, cls: vitals.cls }
}

/** 打开段交互结束后读会话窗 CLS 和最差 INP。 */
export async function readOpenVitals(page: Page): Promise<OpenVitals> {
  await nextPaint(page)
  const vitals = await readBench(page)
  return { cls: vitals.cls, inp: vitals.inp }
}
