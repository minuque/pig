import type { TranscriptItem } from "@earendil-works/pi-protocol"
import { expect, seedWorkspace, test } from "./fixtures.js"
import { COMPLEX_SESSION_ID, COMPLEX_SESSION_NAME } from "./prebuild-session.js"

/** 两页历史：首屏拿最新一页并标记还有更早的，点按钮再拿上一页。 */
const LATEST: TranscriptItem[] = [
  { id: "n-u1", role: "user", content: [{ type: "text", text: "较新的问题" }], timestamp: 10 },
  {
    id: "n-a1",
    role: "assistant",
    content: [{ type: "text", text: "较新的回答" }],
    model: { provider: "test", id: "model" },
    timestamp: 11,
    status: "complete",
    stopReason: "stop",
  },
] as TranscriptItem[]
const OLDER: TranscriptItem[] = [
  { id: "o-u1", role: "user", content: [{ type: "text", text: "更早的问题" }], timestamp: 1 },
  {
    id: "o-a1",
    role: "assistant",
    content: [{ type: "text", text: "更早的回答" }],
    model: { provider: "test", id: "model" },
    timestamp: 2,
    status: "complete",
    stopReason: "stop",
  },
] as TranscriptItem[]

test("上翻历史按 before 取上一页，接在头部且不重复", async ({ page, complexGateway }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, complexGateway.workspaceId)

  const before: string[] = []

  await page.route("**/api/v1/platform/transcript**", (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("before")

    if (cursor) before.push(cursor)

    const payload = cursor
      ? { items: OLDER, timings: [], hasMore: false }
      : { items: LATEST, timings: [], hasMore: true }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) })
  })

  await page.goto(complexGateway.entryUrl)
  await expect(page.locator("nav.session-list")).toBeVisible({ timeout: 30_000 })
  await page
    .locator(".session-card", { has: page.getByText(COMPLEX_SESSION_NAME, { exact: true }) })
    .click()
  await expect(page).toHaveURL(new RegExp(`/sessions/${COMPLEX_SESSION_ID}$`))
  await expect(page.getByText("较新的问题", { exact: true })).toBeVisible({ timeout: 30_000 })

  const older = page.getByText("更早的问题", { exact: true })

  await expect(older).toHaveCount(0)

  const more = page.locator(".older-busy")
  await expect(more).toBeVisible()
  await more.click()

  await expect(older).toBeVisible()
  await expect(page.getByText("更早的回答", { exact: true })).toBeVisible()
  // 分页游标用的是当前窗口第一条
  expect(before).toEqual(["n-u1"])
  // 更早的一页接在头部，不再有下一页时入口收起
  const olderBox = await older.boundingBox()
  const newerBox = await page.getByText("较新的问题", { exact: true }).boundingBox()

  expect(olderBox?.y ?? 0).toBeLessThan(newerBox?.y ?? 0)
  await expect(page.locator(".older-busy")).toHaveCount(0)
  // 老行保留，没有整页替换
  await expect(page.getByText("较新的回答", { exact: true })).toBeVisible()
})
