<template>
  <div v-if="session.sessionId.value" class="session-rail">
    <!-- 宽屏：在对话滚动区里独占右侧一列；头部的图标按钮开关它，窄屏改由按钮弹浮层 -->
    <aside v-if="rail.dockedShown.value" class="rail-docked" :aria-label="t('rail.title')">
      <RailCards v-bind="cards" @stop="stopTask" />
    </aside>

    <!-- 摘要卡里点开的内容进这一侧的面板列 -->
    <Teleport v-if="rail.pane.value && paneSlot" :to="paneSlot">
      <RailPane
        :pane="rail.pane.value"
        :sections="sections"
        :stoppable="cards.stoppable"
        :stopping="cards.stopping"
        :session-id="session.sessionId.value"
        :progress="childProgress"
        @stop="stopTask"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import RailCards from "@features/session-rail/components/RailCards.vue"
import RailPane from "@features/session-rail/components/RailPane.vue"
import { useRailCards } from "@features/session-rail/hooks/use-rail-cards.js"
import { useSessionRail } from "@features/session-rail/index.js"
import { usePanelHost } from "@features/split-view/index.js"

const { t } = useI18n()
const rail = useSessionRail()!
const { session, tasks, sections, cards, stopTask } = useRailCards()
/** 面板里那个子任务的进展指纹：状态或最近一步变了就重读子会话。 */
const childProgress = computed(() => {
  const pane = rail.pane.value
  const open = pane?.kind === "child" ? pane.child : undefined
  const task = tasks.value.find(
    (item) => item.kind === "agent" && item.sessionId === open?.sessionId,
  )
  return task?.kind === "agent"
    ? `${task.status}:${task.steps.length}:${task.steps.at(-1) ?? ""}`
    : ""
})
const host = usePanelHost()
const paneSlot = computed(() => host?.slots.get("tasks"))

watch(session.sessionId, rail.enterSession, { immediate: true })

watch(
  () => Boolean(session.sessionId.value && rail.pane.value),
  (open) => (open ? host?.open("tasks") : host?.close("tasks")),
  { immediate: true },
)
</script>

<style scoped>
.session-rail {
  display: contents;
}

/* 正文右侧独占一列：卡片多了自己滚；左右留 1px 给卡片外环，右边距交给滚动条槽 */
.rail-docked {
  inline-size: var(--size-rail);
  min-block-size: 0;
  padding: var(--space-xs) var(--border-width) var(--space-sm);
  overflow-y: auto;
  scrollbar-width: none;
}

/* 拖着卡片往下时，卡片会越过面板的内容高度：拖拽期间不裁剪 */
.rail-docked:has(.is-drag-live) {
  overflow: visible;
}
</style>
