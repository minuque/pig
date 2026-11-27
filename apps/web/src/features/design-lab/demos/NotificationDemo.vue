<template>
  <Story title="Notification">
    <Variant title="Push cards">
      <div class="demo-row">
        <Button variant="secondary" color="neutral" @click="pushDone">Turn Complete</Button>
        <Button variant="secondary" color="neutral" @click="pushWaiting">Waiting Decision</Button>
        <Button variant="secondary" color="neutral" @click="pushFailure">Background Error</Button>
        <Button variant="ghost" color="neutral" @click="clearScreenNotifications">
          Clear Screen
        </Button>
      </div>
    </Variant>

    <Variant title="Bell & Unread">
      <div class="demo-row demo-bell-bar">
        <NotificationBell />
        <span class="demo-meta">Unread: {{ unreadNotificationCount }}</span>
        <Button variant="ghost" color="neutral" @click="resolveAllDemo">Resolve All</Button>
      </div>
    </Variant>

    <NotificationStack />
  </Story>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@pig/ui/button"
import {
  NotificationBell,
  NotificationStack,
  clearScreenNotifications,
  pushNotification,
  resetNotifications,
  resolveNotification,
  unreadNotificationCount,
} from "@pig/ui/notification"
import { toastStatus } from "@pig/ui/toast"

let demoSeq = 0

function pushDone() {
  demoSeq += 1
  pushNotification({
    id: `demo-done-${demoSeq}`,
    title: "Issue Tiers and Completion Status",
    body: "这一轮已完成",
    tone: "success",
    avatar: { kind: "brand" },
    actions: [
      {
        label: "打开",
        primary: true,
        run: () => toastStatus("已跳转到会话", { tone: "info" }),
      },
    ],
  })
}

function pushWaiting() {
  pushNotification({
    id: "demo-waiting",
    title: "等你确认",
    body: "pig-workbench",
    tone: "warning",
    keepUntilResolved: true,
    avatar: { kind: "brand" },
    actions: [
      {
        label: "忽略",
        run: () => resolveNotification("demo-waiting"),
      },
      {
        label: "打开",
        primary: true,
        run: () => resolveNotification("demo-waiting"),
      },
    ],
  })
}

function pushFailure() {
  pushNotification({
    id: "demo-error",
    title: "pi-cc-extensions",
    body: "后台命令失败：测试退出码 1",
    tone: "error",
    keepUntilResolved: true,
    avatar: { kind: "brand" },
    actions: [
      {
        label: "查看",
        primary: true,
        run: () => resolveNotification("demo-error"),
      },
    ],
  })
}

function resolveAllDemo() {
  resolveNotification("demo-waiting")
  resolveNotification("demo-error")
}

onBeforeUnmount(() => {
  resetNotifications()
})
</script>

<style scoped>
.demo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
}

.demo-bell-bar {
  justify-content: flex-start;
}

.demo-meta {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}
</style>
