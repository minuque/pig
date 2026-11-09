<template>
  <div v-if="session.sessionId.value" class="session-rail">
    <!-- 宽屏：常驻在正文右侧留白里 -->
    <aside class="rail-docked" :aria-label="t('rail.title')">
      <RailCards v-bind="cards" @open="rail.openChild" />
    </aside>

    <!-- 窄屏：收成右上角按钮，点开浮层 -->
    <Popover>
      <PopoverTrigger as-child>
        <Button class="rail-toggle" variant="soft" color="gray" size="s">
          <span class="rail-toggle-dot" :data-running="runningCount > 0 || undefined" />
          {{ toggleLabel }}
        </Button>
      </PopoverTrigger>

      <PopoverContent class="rail-popover" align="end">
        <RailCards v-bind="cards" @open="rail.openChild" />
      </PopoverContent>
    </Popover>

    <ChildDrawer :child="rail.child.value" :progress="childProgress" @close="rail.closeChild" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Button } from "@components/ui/button/index.js"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover/index.js"
import { useExtensionUi } from "@features/extension-ui/index.js"
import { useSession } from "@features/session-workbench/index.js"
import ChildDrawer from "@features/session-rail/components/ChildDrawer.vue"
import RailCards from "@features/session-rail/components/RailCards.vue"
import { useSessionRail } from "@features/session-rail/index.js"
import { latestSubagentTasks } from "@features/session-rail/lib/subagent.js"

const { t } = useI18n()
const session = useSession()
const ui = useExtensionUi()
const rail = useSessionRail()!
const tasks = computed(() => latestSubagentTasks(session.transcript.value))
const runningCount = computed(() => tasks.value.filter((task) => task.status === "running").length)
const cards = computed(() => {
  const model = session.projection.value?.model
  const id = session.sessionId.value
  return {
    cwd: session.sessionCwd.value,
    model: model ? model.id : undefined,
    usage: session.contextUsage.value,
    tasks: tasks.value,
    statuses: id ? ui.statuses.value.get(id) : undefined,
  }
})
const toggleLabel = computed(() => {
  const usage = session.contextUsage.value
  const parts = usage ? [`${usage.percent}%`] : []

  if (tasks.value.length)
    parts.push(
      t("rail.taskCount", {
        done: tasks.value.filter((task) => task.status === "done").length,
        total: tasks.value.length,
      }),
    )
  return parts.join(" · ") || t("rail.title")
})
/** 抽屉里那个子任务的进展指纹：状态或最近一步变了就重读子会话。 */
const childProgress = computed(() => {
  const open = rail.child.value
  const task = tasks.value.find((item) => item.sessionId === open?.sessionId)
  return task ? `${task.status}:${task.steps.length}:${task.steps.at(-1) ?? ""}` : ""
})
</script>

<style scoped>
.session-rail {
  display: contents;
}

/* 正文居中、两侧都放得下面板才常驻；容器宽度由会话面板提供 */
.rail-docked {
  position: absolute;
  inset-block-start: calc(var(--header-height) + var(--space-xs));
  inset-inline-end: var(--space-md);
  z-index: var(--z-menu);
  display: none;
  inline-size: var(--size-rail);
}

.rail-toggle {
  position: absolute;
  inset-block-start: calc((var(--header-height) - var(--size-icon-button)) / 2);
  inset-inline-end: var(--space-md);
  z-index: var(--z-menu);
  gap: var(--space-xxs);
  font-size: var(--text-meta);
}

.rail-toggle-dot {
  inline-size: var(--space-xs);
  block-size: var(--space-xs);
  background: var(--contrast-foreground-faint);
  border-radius: var(--radius-pill);
}

.rail-toggle-dot[data-running] {
  background: var(--primary);
}

@container session-panel (min-width: 1320px) {
  .rail-docked {
    display: block;
  }

  .rail-toggle {
    display: none;
  }
}
</style>

<style>
/* 浮层经 Portal 挂到 body，scoped 打不中 */
.rail-popover.rt-PopoverContent {
  inline-size: var(--size-rail);
  padding: var(--space-xs);
}
</style>
