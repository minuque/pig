<template>
  <div ref="root" class="file-split">
    <SplitterGroup direction="horizontal" auto-save-id="pig.files.split" class="file-split-group">
      <SplitterPanel
        :order="1"
        :min-size="CHAT_MIN"
        size-unit="px"
        class="file-split-chat"
        :data-pane="docked || undefined"
      >
        <slot />
      </SplitterPanel>

      <template v-if="docked">
        <SplitterResizeHandle class="file-split-handle" />

        <SplitterPanel
          :order="2"
          :default-size="PANE_DEFAULT"
          :min-size="PANE_MIN"
          size-unit="px"
          class="file-split-pane"
        >
          <FilePanel />
        </SplitterPanel>
      </template>
    </SplitterGroup>

    <!-- 放不下对话最小宽度时盖住对话 -->
    <div v-if="covering" class="file-split-cover">
      <FilePanel covering />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from "reka-ui"
import { useSession } from "@features/session/index.js"
import FilePanel from "@features/file-pane/components/FilePanel.vue"
import { useFilePane } from "@features/file-pane/index.js"

/** 对话最小宽度与右侧面板的门槛一致；面板默认与最窄宽度照 cc-wrapper 的侧栏 tile。 */
const CHAT_MIN = 640
const PANE_MIN = 320
const PANE_DEFAULT = 560
const pane = useFilePane()
const { sessionId } = useSession()
const root = useTemplateRef("root")
const width = shallowRef(Number.POSITIVE_INFINITY)
const shown = computed(() => pane.open.value && Boolean(sessionId.value))
const narrow = computed(() => width.value < CHAT_MIN + PANE_MIN)
const docked = computed(() => shown.value && !narrow.value)
const covering = computed(() => shown.value && narrow.value)

useResizeObserver(root, ([entry]) => {
  if (entry) width.value = entry.contentRect.width
})
</script>

<style scoped>
.file-split {
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
}

.file-split-group {
  flex: 1;
  min-width: 0;
}

.file-split-chat {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Files 贴在窗口右边：Windows 窗控让位挪到 Files 头部 */
.file-split-chat[data-pane] {
  --titlebar-controls-inset: 0px;
}

.file-split-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space-sm) var(--space-sm) var(--space-sm) 0;
}

/* 拖拽区就是对话与面板之间的空隙 */
.file-split-handle {
  inline-size: var(--space-sm);
  cursor: col-resize;
}

.file-split-handle:focus-visible {
  outline: var(--focus-ring);
}

.file-split-cover {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: var(--space-sm);
  background: var(--background);
}
</style>
