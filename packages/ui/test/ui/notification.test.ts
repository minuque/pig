import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearNotificationHistory,
  clearScreenNotifications,
  dismissNotificationScreen,
  historyNotifications,
  markNotificationsRead,
  notificationAnnouncement,
  pushNotification,
  removeNotificationHistory,
  resetNotifications,
  resolveNotification,
  resolveNotificationsForSession,
  screenNotifications,
  unreadNotificationCount,
} from "../../src/ui/notification/index.js"

afterEach(() => {
  resetNotifications()
})

describe("notification store", () => {
  it("推送通知后加入屏幕列表与未读计数，并触发屏幕阅读播报", async () => {
    const run = vi.fn()
    const id = pushNotification({
      id: "turn:s1",
      title: "对话标题",
      body: "这一轮已完成",
      tone: "success",
      sessionId: "s1",
      actions: [{ label: "打开", primary: true, run }],
    })

    expect(screenNotifications.value.map((item) => item.id)).toEqual([id])
    expect(historyNotifications.value).toHaveLength(1)
    expect(unreadNotificationCount.value).toBe(1)

    await Promise.resolve()
    expect(notificationAnnouncement.value).toBe("对话标题. 这一轮已完成")
  })

  it("普通通知清出屏幕后同时已读；等待决策或持久错误会保留未解决计数直至 resolve", () => {
    pushNotification({
      id: "done:s1",
      title: "会话 A",
      body: "这一轮已完成",
      tone: "success",
      sessionId: "s1",
    })
    pushNotification({
      id: "waiting:s2",
      title: "等你回答",
      body: "会话 B",
      tone: "warning",
      sessionId: "s2",
      keepUntilResolved: true,
    })

    clearScreenNotifications()
    expect(screenNotifications.value).toHaveLength(0)
    expect(unreadNotificationCount.value).toBe(1)

    clearNotificationHistory()
    expect(historyNotifications.value.map((item) => item.id)).toEqual(["waiting:s2"])

    resolveNotification("waiting:s2")
    expect(unreadNotificationCount.value).toBe(0)

    clearNotificationHistory()
    expect(historyNotifications.value).toHaveLength(0)
  })

  it("按 id 更新会回到顶部，打开通知中心将非决策项标为已读", () => {
    pushNotification({ id: "a", title: "旧通知", tone: "info" })
    pushNotification({ id: "b", title: "新通知", tone: "info" })
    expect(screenNotifications.value.map((item) => item.id)).toEqual(["b", "a"])

    pushNotification({ id: "a", title: "更新后的旧通知", tone: "info" })
    expect(screenNotifications.value.map((item) => item.id)).toEqual(["a", "b"])

    dismissNotificationScreen("a")
    expect(screenNotifications.value.map((item) => item.id)).toEqual(["b"])

    markNotificationsRead()
    expect(unreadNotificationCount.value).toBe(0)

    removeNotificationHistory("a")
    expect(historyNotifications.value.map((item) => item.id)).toEqual(["b"])
  })

  it("支持按会话批量解决通知", () => {
    pushNotification({
      id: "turn:s1",
      title: "失败",
      tone: "error",
      sessionId: "s1",
      keepUntilResolved: true,
    })
    pushNotification({
      id: "turn:s2",
      title: "失败",
      tone: "error",
      sessionId: "s2",
      keepUntilResolved: true,
    })

    resolveNotificationsForSession("s1")
    expect(unreadNotificationCount.value).toBe(1)
    expect(historyNotifications.value.find((item) => item.id === "turn:s1")?.resolved).toBe(true)
  })
})
