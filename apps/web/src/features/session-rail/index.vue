<template>
  <div v-if="session.sessionId.value" class="session-rail">
    <!-- 宽屏：常驻在正文右侧留白里，头部的图标按钮开关它；窄屏改由按钮弹浮层 -->
    <aside
      class="rail-docked"
      :data-open="rail.docked.value || undefined"
      :aria-label="t('rail.title')"
    >
      <RailCards v-bind="cards" @open="rail.openChild" @stop="stopTask" />
    </aside>

    <ChildDrawer :child="rail.child.value" :progress="childProgress" @close="rail.closeChild" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import ChildDrawer from "@features/session-rail/components/ChildDrawer.vue"
import RailCards from "@features/session-rail/components/RailCards.vue"
import { useRailCards } from "@features/session-rail/hooks/use-rail-cards.js"
import { useSessionRail } from "@features/session-rail/index.js"

const { t } = useI18n()
const rail = useSessionRail()!
const { session, tasks, cards, stopTask } = useRailCards()
/** 抽屉里那个子任务的进展指纹：状态或最近一步变了就重读子会话。 */
const childProgress = computed(() => {
  const open = rail.child.value
  const task = tasks.value.find(
    (item) => item.kind === "agent" && item.sessionId === open?.sessionId,
  )
  return task?.kind === "agent"
    ? `${task.status}:${task.steps.length}:${task.steps.at(-1) ?? ""}`
    : ""
})
</script>

<style scoped>
.session-rail {
  display: contents;
}

/* 会话面板的右列，叠在横跨两列的对话列上方：高度随内容，最高到列底，超出自己滚；
   右侧留的间距里是对话列的滚动条 */
.rail-docked {
  position: relative;
  z-index: 1;
  grid-area: 2 / 2;
  align-self: start;
  display: none;
  inline-size: var(--size-rail);
  max-block-size: calc(100% - var(--space-xs) - var(--space-sm));
  margin-block: var(--space-xs) var(--space-sm);
  margin-inline-end: var(--space-sm);
  padding: 1px;
  overflow-y: auto;
  scrollbar-width: none;
}

/* 拖着卡片往下时，卡片会越过面板的内容高度：拖拽期间不裁剪 */
.rail-docked:has(.is-drag-live) {
  overflow: visible;
}

/* 放得下最小正文宽（640）加面板与间距才常驻（照 t3code：640 + 280 + 12 + 32 + 48） */
@container session-panel (min-width: 1012px) {
  .rail-docked[data-open] {
    display: block;
  }
}
</style>
