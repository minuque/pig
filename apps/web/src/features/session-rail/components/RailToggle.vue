<template>
  <div v-if="session.sessionId.value" class="rail-toggle">
    <!-- 宽屏：开关常驻面板 -->
    <Tooltip>
      <TooltipTrigger as-child>
        <IconButton
          class="rail-toggle-docked"
          type="button"
          size="m"
          color="gray"
          variant="ghost"
          :data-active="rail.docked.value || undefined"
          :aria-pressed="rail.docked.value"
          :aria-label="t('rail.toggle')"
          @click="rail.toggleDocked"
        >
          <PanelTextRightIcon :size="16" />
          <span v-if="runningCount > 0" class="rail-toggle-dot" />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ label }}</TooltipContent>
    </Tooltip>

    <!-- 窄屏：点开浮层 -->
    <Popover v-model:open="popoverOpen">
      <Tooltip>
        <PopoverTrigger as-child>
          <TooltipTrigger as-child>
            <IconButton
              ref="popoverButton"
              class="rail-toggle-popover"
              type="button"
              size="m"
              color="gray"
              variant="ghost"
              :data-active="popoverOpen || undefined"
              :aria-label="t('rail.toggle')"
            >
              <PanelTextRightIcon :size="16" />
              <span v-if="runningCount > 0" class="rail-toggle-dot" />
            </IconButton>
          </TooltipTrigger>
        </PopoverTrigger>

        <TooltipContent>{{ label }}</TooltipContent>
      </Tooltip>

      <!-- Tooltip 会把触发器的锚点登记到自己名下，浮层改用显式锚点 -->
      <PopoverContent class="rail-popover" align="end" :reference="popoverButton?.$el">
        <RailCards v-bind="cards" @open="rail.openChild" />
      </PopoverContent>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, type ComponentPublicInstance } from "vue"
import { useI18n } from "@i18n/index.js"
import { PanelTextRightIcon } from "@components/icons/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import RailCards from "@features/session-rail/components/RailCards.vue"
import { useRailCards } from "@features/session-rail/hooks/use-rail-cards.js"
import { useSessionRail } from "@features/session-rail/index.js"

const { t } = useI18n()
const rail = useSessionRail()!
const { session, tasks, runningCount, cards } = useRailCards()
const popoverOpen = ref(false)
const popoverButton = useTemplateRef<ComponentPublicInstance>("popoverButton")
/** 提示里带上上下文用量与任务进度，收起时也能一眼看到。 */
const label = computed(() => {
  const usage = session.contextUsage.value
  const parts = [t("rail.title"), ...(usage ? [`${usage.percent}%`] : [])]

  if (tasks.value.length)
    parts.push(
      t("rail.taskCount", {
        done: tasks.value.filter((task) => task.status === "completed").length,
        total: tasks.value.length,
      }),
    )
  return parts.join(" · ")
})
</script>

<style scoped>
.rail-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.rail-toggle-docked {
  display: none;
}

.rail-toggle :is(.rail-toggle-docked, .rail-toggle-popover) {
  position: relative;
}

/* 按下态：面板开着（或浮层开着）时用项目统一的选中底色 */
.rail-toggle [data-active] {
  color: var(--contrast-foreground);
  background: var(--btn-selected);
}

/* 有子任务在跑时，图标右上角亮一个点 */
.rail-toggle-dot {
  position: absolute;
  inset-block-start: var(--space-xxs);
  inset-inline-end: var(--space-xxs);
  inline-size: var(--space-xs);
  block-size: var(--space-xs);
  background: var(--primary);
  border-radius: var(--radius-pill);
}

/* 与常驻面板同一门槛 */
@container session-panel (min-width: 1012px) {
  .rail-toggle-docked {
    display: inline-flex;
  }

  .rail-toggle-popover {
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
