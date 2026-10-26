<!-- 工作台壳：结构与间距照搬自 features/session-workbench/index.vue，改那边要同步 -->
<template>
  <div class="session-panel" :class="{ 'is-drop-active': dropActive }">
    <div class="drop-guide" aria-hidden="true">
      <span class="drop-guide-label">
        <DocumentAddIcon class="drop-guide-icon" />
        {{ t("composer.dropGuide") }}
      </span>
    </div>

    <slot
      name="header"
      :sidebar-expanded="sidebarExpanded"
      :sidebar-open="sidebarOpen"
      :toggle-sidebar="toggleSidebar"
    />

    <div
      class="conversation-column"
      :class="{ 'is-content-resizing': resizing || dragging }"
      :style="columnStyle"
    >
      <slot v-if="error" name="error" />

      <template v-else>
        <div class="session-stage">
          <div v-if="idle" class="idle-hero">
            <slot name="hero" />
          </div>

          <slot v-else name="body" />
        </div>

        <div ref="bar" class="composer-bar" :class="{ 'is-hero': idle }">
          <div class="composer-stack">
            <div class="session-floating-controls" :class="{ shown: scrollShown }">
              <slot name="floating" />
            </div>

            <slot name="composer" />
          </div>
        </div>
      </template>

      <template v-if="showHandles">
        <ContentWidthHandle
          v-for="side in HANDLE_SIDES"
          :key="side"
          :side="side"
          :measure="measure"
          @start="beginResize"
          @drag="onDrag"
          @commit="onCommit"
          @end="endResize"
          @nudge="onNudge"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, useTemplateRef } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { leftPanelKey } from "@components/layout/hooks/use-left-panel.js"
import ContentWidthHandle from "@features/session-workbench/components/ContentWidthHandle.vue"
import { DocumentAddIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    /** 拖拽态：显示拖拽引导层。 */
    dropActive?: boolean
    /** 空会话：正文区换成 Hero，输入条抬到 --hero-dock。 */
    idle?: boolean
    /** 启动错误：正文区换成错误条，输入条与 Hero 都不出。 */
    error?: boolean
    showHandles?: boolean
    /** 内容宽：写到 .conversation-column 的 --chat-user-width。 */
    contentWidth?: number
    /** 拖拽中：列上挂 is-content-resizing。 */
    resizing?: boolean
    /** 「回到底部」浮钮显隐，真实信号来自 TranscriptView。 */
    scrollShown?: boolean
    /** 当前内容宽，交给真实把手做拖拽基准。 */
    measure: () => number
  }>(),
  {
    dropActive: false,
    idle: false,
    error: false,
    showHandles: false,
    resizing: false,
    scrollShown: false,
  },
)
const emit = defineEmits<{
  start: []
  drag: [width: number]
  commit: [width: number]
  end: []
  nudge: [delta: number]
}>()
const HANDLE_SIDES = ["left", "right"] as const
const { t } = useI18n()
const panel = inject(leftPanelKey, null)
const sidebarExpanded = computed(() => panel?.sbState.value === "expanded")
const sidebarOpen = computed(() => panel?.leftOpen.value ?? true)

/** 侧栏收起钮与头部按钮共用：两者都改同一个面板状态，谁的入口都同步。 */
function toggleSidebar(): void {
  panel?.setSbState(sidebarExpanded.value ? "offcanvas" : "expanded")
}

defineExpose({ toggleSidebar })

const bar = useTemplateRef<HTMLElement>("bar")
const reserve = ref("7rem")
/** 把手内部的拖拽态：故事没接 start / end 时也要冻住列。 */
const dragging = ref(false)
/** 宽度与输入条留白都写到列上，样式规则不变。 */
const columnStyle = computed(() => {
  const style: Record<string, string> = { "--composer-reserve": reserve.value }

  if (props.contentWidth !== undefined) style["--chat-user-width"] = `${props.contentWidth}px`
  return style
})

// 输入条脱离文档流后，把边框盒高度写给列；正文与 Hero 都靠它留白
useResizeObserver(
  bar,
  (entries) => {
    const height = entries[0]?.borderBoxSize?.[0]?.blockSize ?? 0

    if (height > 0) reserve.value = `${Math.ceil(height)}px`
  },
  { box: "border-box" },
)

function beginResize(): void {
  dragging.value = true
  emit("start")
}

function endResize(): void {
  dragging.value = false
  emit("end")
}

function onDrag(width: number): void {
  emit("drag", width)
}

function onCommit(width: number): void {
  emit("commit", width)
}

function onNudge(delta: number): void {
  emit("nudge", delta)
}
</script>

<style scoped>
.session-panel {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.drop-guide {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-smooth);
}

.session-panel.is-drop-active .drop-guide {
  opacity: 1;
}

.drop-guide-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: var(--border-width) dashed var(--primary);
  border-radius: var(--radius-full);
  background: var(--composer-background);
  color: var(--primary);
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
}

.drop-guide-icon {
  width: var(--size-icon);
  height: var(--size-icon);
}

.conversation-column {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 测量前占位，挂上后由输入条边框盒覆盖 */
  --composer-reserve: 7rem;
  --size-content: var(--chat-user-width, 680px);
  /* 首屏输入条底边离列底的距离 */
  --hero-dock: 34%;
}

.conversation-column.is-content-resizing {
  cursor: col-resize;
  user-select: none;
}

.session-stage {
  position: relative;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.session-stage :deep(.row-tools) {
  position: relative;
  z-index: 2;
}

/* 首屏：Hero 贴在输入条上沿，两者作为一组略高于垂直中线 */
.idle-hero {
  position: absolute;
  inset: 0 0 calc(var(--hero-dock) + var(--composer-reserve));
  display: grid;
  place-items: end center;
  padding-inline: var(--space-md);
  padding-bottom: var(--space-xl);
}

.composer-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 2;
  padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.composer-bar.is-hero {
  bottom: var(--hero-dock);
}

/* 输入条下方留白缝的蒙层：盖住滚动露出的 transcript；右侧让出滚动条槽位 */
.session-stage::after {
  content: "";
  position: absolute;
  inset-inline-start: 0;
  inset-inline-end: var(--space-sm);
  inset-block-end: 0;
  z-index: 1;
  height: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px) + var(--edge-fade-band));
  pointer-events: none;
  background: linear-gradient(
    to top,
    var(--background) calc(var(--space-sm) + env(safe-area-inset-bottom, 0px)),
    transparent
  );
  backdrop-filter: blur(var(--glass-blur, 16px)) saturate(var(--glass-saturation, 1.08));
  mask-image: linear-gradient(
    to top,
    black calc(var(--space-sm) + env(safe-area-inset-bottom, 0px)),
    transparent
  );
}

.composer-stack {
  position: relative;
  width: 100%;
  max-width: calc(var(--size-content) + var(--space-sm));
  margin-inline: auto;
  background: transparent;
  pointer-events: auto;
}

.session-floating-controls {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: var(--space-sm);
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  height: 0;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-floating-controls.shown {
  opacity: 1;
}

/* 浮钮由故事插槽提供，不在本组件的作用域里 */
.session-floating-controls :deep(.scroll-latest-control) {
  width: var(--size-scroll-control);
  height: var(--size-scroll-control);
  border-radius: var(--radius-full);
  background: var(--popover);
  color: var(--contrast-foreground-secondary);
  box-shadow: none;
  cursor: pointer;
  transform: translateY(calc(-100% - var(--space-sm)));
}

.session-floating-controls.shown :deep(.scroll-latest-control) {
  pointer-events: auto;
}

.session-floating-controls :deep(.scroll-latest-control:hover) {
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
}

@media (max-width: 900px) {
  .composer-bar {
    padding-inline: var(--space-sm);
  }
}

@media (prefers-reduced-motion: reduce) {
  .session-floating-controls {
    transition: none;
  }

  .drop-guide {
    transition: none;
  }
}
</style>
