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
  fcp: number
  cls: number
  longTasks: { start: number; duration: number }[]
}

type StartVitals = { fcp: number; cls: number }

/** 注入 FCP / CLS / longtask，须在首次 goto 前调用。 */
export async function installObservers(page: Page) {
  await page.addInitScript({
    content: `window.__pigBench = { fcp: 0, cls: 0, longTasks: [] };
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
  observe("paint", null, function (entry) {
    if (entry.name === "first-contentful-paint") bench.fcp = entry.startTime;
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
})();`,
  })
}

function readBench(page: Page) {
  return page.evaluate(() => {
    const bench = (window as unknown as { __pigBench: PageBench }).__pigBench
    const paints = performance.getEntriesByType("paint")
    const fcpEntry = paints.find((entry) => entry.name === "first-contentful-paint")
    const fcp = bench.fcp || fcpEntry?.startTime || 0
    return { fcp, cls: bench.cls }
  })
}

/** 工作台就绪时读导航期 FCP / CLS。 */
export async function readStartVitals(page: Page): Promise<StartVitals> {
  await nextPaint(page)
  const vitals = await readBench(page)

  if (!vitals.fcp) throw new Error("未采集到 FCP，不能生成启动结果")
  return vitals
}
