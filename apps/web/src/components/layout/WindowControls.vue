<template>
  <div v-if="bridge" class="window-controls">
    <Tooltip v-for="control in controls" :key="control.id">
      <TooltipTrigger as-child>
        <IconButton
          type="button"
          size="m"
          variant="ghost"
          :data-window-control="control.id"
          :aria-label="control.label"
          @click="control.run"
        >
          <component :is="control.icon" class="size-icon-2xs" />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ control.label }}</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue"
import { CopyIcon, MinusIcon, SquareIcon, XIcon } from "@components/icons/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useI18n } from "@i18n/index.js"

/** macOS 保留原生红绿灯，只有 Windows 与 Linux 画窗控。 */
const platform = document.documentElement.dataset.pigDesktopPlatform
const bridge = platform === "win32" || platform === "linux" ? window.pigDesktop?.window : undefined
const { t } = useI18n()
const maximized = ref(false)

if (bridge) {
  void bridge.isMaximized().then((value) => (maximized.value = value))
  onScopeDispose(bridge.onMaximizedChange((value) => (maximized.value = value)))
}

const controls = computed(() => [
  { id: "minimize", label: t("window.minimize"), icon: MinusIcon, run: () => bridge?.minimize() },
  {
    id: maximized.value ? "restore" : "maximize",
    label: maximized.value ? t("window.restore") : t("window.maximize"),
    icon: maximized.value ? CopyIcon : SquareIcon,
    run: () => bridge?.toggleMaximize(),
  },
  { id: "close", label: t("window.close"), icon: XIcon, run: () => bridge?.close() },
])
</script>

<style scoped>
/* 与工作台头部同一行：高度取头部高，右侧留白与头部内边距一致 */
.window-controls {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  z-index: var(--z-window-controls);
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  height: var(--header-height);
  padding-inline-end: var(--space-sm);
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
</style>
