import { expect, test } from "./fixtures.js"
import {
  COMPLEX_MARKER,
  COMPLEX_SESSION_ID,
  SHORT_BODY_MARKER,
  SHORT_BODY_SESSION_ID,
} from "./prebuild-session.js"

const BODY_VISIBLE_LIMIT_MS = 5_000

const INIT = `window.__pigBody = { bodyVisible: 0, lcpAll: [] };
(function () {
  function isLogo(el, url) {
    if (url && /logo\\.png/.test(url)) return true;
    if (!el) return false;
    var cls = String(el.className || "");
    var id = String(el.id || "");
    return cls.indexOf("startup-logo") >= 0 || id === "startup-splash" || cls.indexOf("startup-screen") >= 0;
  }
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        var el = e.element;
        window.__pigBody.lcpAll.push({
          t: e.startTime,
          size: e.size,
          tag: el && el.tagName,
          cls: String((el && el.className) || ""),
          url: e.url || "",
          logo: isLogo(el, e.url || "")
        });
      });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {}
})();`

type BodyPaint = {
  bodyVisible: number
  officialLcp?: { t: number; tag: string; cls: string; url: string; logo: boolean; size: number }
}

async function openSessionBodyPaint(
  page: import("@playwright/test").Page,
  origin: string,
  workspaceId: string,
  sessionId: string,
  marker: string,
): Promise<BodyPaint> {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript({ content: INIT })
  await page.addInitScript(
    ({ workspaceId: id }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([id]))
      localStorage.setItem("pig.lastCwd", id)
      localStorage.setItem("npg-theme", "light")
    },
    { workspaceId },
  )
  await page.goto(`${origin}/sessions/${sessionId}`, { waitUntil: "domcontentloaded" })
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 30_000 })
  await page.locator(".startup-screen").waitFor({ state: "detached" })
  await page.locator(".session-loading").waitFor({ state: "hidden" })
  return page.evaluate((text) => {
    const rows = document.querySelector(".timeline-rows")
    if (!rows?.classList.contains("is-paint-skip")) throw new Error("时间线尚未揭开")
    if (getComputedStyle(rows).visibility === "hidden") throw new Error("时间线仍隐藏")
    const panel = document.getElementById("transcript-panel")
    if (!panel?.innerText.includes(text)) throw new Error("正文标记不在时间线")
    const slot = window as unknown as {
      __pigBody: { bodyVisible: number; lcpAll: BodyPaint["officialLcp"][] }
    }
    if (!slot.__pigBody.bodyVisible) slot.__pigBody.bodyVisible = performance.now()
    const officialLcp = slot.__pigBody.lcpAll.at(-1)
    return officialLcp
      ? { bodyVisible: slot.__pigBody.bodyVisible, officialLcp }
      : { bodyVisible: slot.__pigBody.bodyVisible }
  }, marker)
}

function assertBodyVisible(paint: BodyPaint, sessionId: string) {
  const official = paint.officialLcp
  if (official?.logo) {
    expect(official.t, "logo 时刻不得冒充正文 LCP").not.toBe(paint.bodyVisible)
  }
  expect(
    paint.bodyVisible,
    `${sessionId} 正文可见 ${Math.round(paint.bodyVisible)}ms（官方 LCP ${official?.logo ? "logo" : official?.tag} ${official ? Math.round(official.t) : "?"}ms）`,
  ).toBeLessThan(BODY_VISIBLE_LIMIT_MS)
}

test("冷打开复杂存量会话：正文可见 5s 内且不计 logo", async ({ page, bodyLcpGateway }) => {
  test.setTimeout(90_000)
  const paint = await openSessionBodyPaint(
    page,
    bodyLcpGateway.origin,
    bodyLcpGateway.workspaceId,
    COMPLEX_SESSION_ID,
    COMPLEX_MARKER,
  )
  assertBodyVisible(paint, COMPLEX_SESSION_ID)
})

test("冷打开短末条存量会话：正文可见 5s 内且不计 logo", async ({ page, bodyLcpGateway }) => {
  test.setTimeout(90_000)
  const paint = await openSessionBodyPaint(
    page,
    bodyLcpGateway.origin,
    bodyLcpGateway.workspaceId,
    SHORT_BODY_SESSION_ID,
    SHORT_BODY_MARKER,
  )
  assertBodyVisible(paint, SHORT_BODY_SESSION_ID)
})
