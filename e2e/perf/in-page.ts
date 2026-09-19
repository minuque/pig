import type { Locator, Page } from "@playwright/test"

export type PageWaitSpec = {
  urlPath?: string
  rowText?: string
  bodyIncludes?: string
  textIn?: { selector: string; text: string }
  present?: readonly string[]
  gone?: readonly string[]
  clickMore?: string
  latestInViewport?: boolean
}

const DEFAULT_TIMEOUT_MS = 30_000

type PigWindow = {
  __pigWaitFor: (spec: PageWaitSpec, timeoutMs: number) => Promise<number>
  __pigArmClick: (el: EventTarget, steps: Record<string, PageWaitSpec>, timeoutMs: number) => void
  __pigArmNow: (steps: Record<string, PageWaitSpec>, timeoutMs: number) => void
  __pigArmResult?: Promise<Record<string, number>>
  __pigArmSteps?: Record<string, Promise<number>>
}

/** 自包含注入，避开 tsx keepNames 序列化。 */
const PAGE_WAIT_SOURCE = `(function () {
  function visible(el) {
    return !!el && el.getClientRects().length > 0;
  }
  function textOf(el) {
    return (el.textContent || "").trim();
  }
  function anyVisible(selector) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) if (visible(nodes[i])) return true;
    return false;
  }
  function allGone(selector) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) if (visible(nodes[i])) return false;
    return true;
  }
  function hasRowText(text) {
    var rows = document.querySelectorAll(".row-user, .row-assistant");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!visible(row)) continue;
      if (textOf(row) === text) return true;
      var nodes = row.querySelectorAll("*");
      for (var j = 0; j < nodes.length; j++) {
        if (visible(nodes[j]) && textOf(nodes[j]) === text) return true;
      }
    }
    return false;
  }
  function hasTextIn(selector, text) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (visible(el) && (el.textContent || "").indexOf(text) >= 0) return true;
    }
    return false;
  }
  function latestInView() {
    var viewport = document.querySelector(".transcript-viewport");
    var assistants = document.querySelectorAll(".row-assistant");
    var latest = assistants[assistants.length - 1];
    var composer = document.querySelector(".composer .field, .field");
    if (!viewport || !latest || !composer || composer.readOnly || composer.disabled) return false;
    var vr = viewport.getBoundingClientRect();
    var lr = latest.getBoundingClientRect();
    return lr.bottom > vr.top && lr.top < vr.bottom;
  }
  function matches(spec) {
    if (spec.urlPath != null && location.pathname !== spec.urlPath) return false;
    if (spec.rowText != null && !hasRowText(spec.rowText)) return false;
    if (spec.bodyIncludes != null &&
        !(document.body && document.body.innerText.indexOf(spec.bodyIncludes) >= 0)) return false;
    if (spec.textIn && !hasTextIn(spec.textIn.selector, spec.textIn.text)) return false;
    if (spec.present) {
      for (var i = 0; i < spec.present.length; i++) if (!anyVisible(spec.present[i])) return false;
    }
    if (spec.gone) {
      for (var j = 0; j < spec.gone.length; j++) if (!allGone(spec.gone[j])) return false;
    }
    if (spec.latestInViewport && !latestInView()) return false;
    return true;
  }
  function waitRaw(spec, timeoutMs) {
    var start = performance.now();
    return new Promise(function (resolve, reject) {
      var deadline = start + timeoutMs;
      var moreClicks = 0;
      function tick() {
        if (matches(spec)) {
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              var at = performance.now();
              resolve({ elapsed: at - start, at: at });
            });
          });
          return;
        }
        if (spec.clickMore && moreClicks < 20 &&
            !(spec.textIn && hasTextIn(spec.textIn.selector, spec.textIn.text))) {
          var more = document.querySelector(spec.clickMore);
          if (more) {
            more.click();
            moreClicks += 1;
          }
        }
        if (performance.now() >= deadline) {
          reject(new Error("__pigWaitFor timeout " + timeoutMs + "ms " + JSON.stringify(spec)));
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }
  function armSteps(steps, timeoutMs, mode) {
    var keys = Object.keys(steps);
    var stamps = {};
    var pending = {};
    for (var i = 0; i < keys.length; i++) {
      (function (key) {
        pending[key] = waitRaw(steps[key], timeoutMs).then(function (hit) {
          var value = mode === "at" ? hit.at : hit.elapsed;
          stamps[key] = value;
          return value;
        });
      })(keys[i]);
    }
    window.__pigArmSteps = pending;
    window.__pigArmResult = Promise.all(keys.map(function (key) { return pending[key]; }))
      .then(function () { return stamps; });
  }
  window.__pigWaitFor = function (spec, timeoutMs) {
    return waitRaw(spec, timeoutMs).then(function (hit) { return hit.elapsed; });
  };
  window.__pigArmClick = function (el, steps, timeoutMs) {
    el.addEventListener("click", function () { armSteps(steps, timeoutMs, "elapsed"); }, { once: true });
  };
  window.__pigArmNow = function (steps, timeoutMs) {
    armSteps(steps, timeoutMs, "at");
  };
})();`

export async function installPageWaitFor(page: Page) {
  await page.addInitScript({ content: PAGE_WAIT_SOURCE })
}

export async function waitInPage(page: Page, spec: PageWaitSpec, timeout = DEFAULT_TIMEOUT_MS) {
  return page.evaluate(
    ({ spec, timeout }) => {
      const wait = (window as unknown as PigWindow).__pigWaitFor

      if (typeof wait !== "function") throw new Error("页面内计时未注入")
      return wait(spec, timeout)
    },
    { spec, timeout },
  )
}

/** 点击瞬间起步，记录各 step 从点击到命中的页面毫秒。 */
export async function armClickStamps(
  page: Page,
  locator: Locator,
  steps: Record<string, PageWaitSpec>,
  timeout = DEFAULT_TIMEOUT_MS,
) {
  await locator.evaluate(
    (el, arg) => {
      const arm = (window as unknown as PigWindow).__pigArmClick

      if (typeof arm !== "function") throw new Error("页面内计时未注入")
      arm(el, arg.steps, arg.timeout)
    },
    { steps, timeout },
  )
}

/** 立刻并行起步，记录命中时的页面时刻。 */
export async function armStamps(
  page: Page,
  steps: Record<string, PageWaitSpec>,
  timeout = DEFAULT_TIMEOUT_MS,
) {
  await page.evaluate(
    ({ steps, timeout }) => {
      const arm = (window as unknown as PigWindow).__pigArmNow

      if (typeof arm !== "function") throw new Error("页面内计时未注入")
      arm(steps, timeout)
    },
    { steps, timeout },
  )
}

export function clickStamps(page: Page): Promise<Record<string, number>>
export function clickStamps(page: Page, key: string): Promise<number>
export async function clickStamps(page: Page, key?: string) {
  if (key == null) {
    return page.evaluate(() => {
      const result = (window as unknown as PigWindow).__pigArmResult

      if (!result) throw new Error("未挂页面计时")
      return result
    })
  }

  return page.evaluate((k) => {
    const pending = (window as unknown as PigWindow).__pigArmSteps?.[k]

    if (!pending) throw new Error(`未挂 step ${k}`)
    return pending
  }, key)
}

export async function pageClockOffset(page: Page) {
  const nodeBefore = performance.now()
  const pageNow = await page.evaluate(() => performance.now())
  const nodeAfter = performance.now()
  return (nodeBefore + nodeAfter) / 2 - pageNow
}
