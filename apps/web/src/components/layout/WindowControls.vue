<template>
  <div v-if="supported" class="window-controls">
    <button
      class="window-control"
      type="button"
      data-window-control="minimize"
      :aria-label="t('window.minimize')"
      @click="bridge?.minimize()"
    >
      <svg class="window-glyph" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 5h6" />
      </svg>
    </button>

    <button
      class="window-control"
      type="button"
      :data-window-control="maximized ? 'restore' : 'maximize'"
      :aria-label="maximized ? t('window.restore') : t('window.maximize')"
      @click="bridge?.toggleMaximize()"
    >
      <svg v-if="maximized" class="window-glyph" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M3.5 3.5V2h4.5v4.5H6.5" />
        <rect x="2" y="3.5" width="4.5" height="4.5" rx="0.75" />
      </svg>

      <svg v-else class="window-glyph" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="2.25" y="2.25" width="5.5" height="5.5" rx="0.75" />
      </svg>
    </button>

    <button
      class="window-control is-close"
      type="button"
      data-window-control="close"
      :aria-label="t('window.close')"
      @click="bridge?.close()"
    >
      <svg class="window-glyph" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { useI18n } from "@i18n/index.js"

/** macOS 保留原生红绿灯；只有 Windows 与 Linux 自画窗控。 */
const platform = document.documentElement.dataset.pigDesktopPlatform
const supported = platform === "win32" || platform === "linux"
const bridge = supported ? window.pigDesktop?.window : undefined
const { t } = useI18n()
const maximized = ref(false)
let stopListening: (() => void) | undefined

onMounted(async () => {
  if (!bridge) return

  maximized.value = await bridge.isMaximized()
  stopListening = bridge.onMaximizedChange((value) => {
    maximized.value = value
  })
})

onBeforeUnmount(() => stopListening?.())
</script>

<style scoped>
.window-controls {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  z-index: var(--z-window-controls);
  display: flex;
  height: var(--titlebar-inset);
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.window-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--size-window-control);
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--toolbar-foreground);
  cursor: default;
}

.window-control:hover,
.window-control:focus-visible {
  background: var(--hover-quiet);
}

.window-control:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.window-control.is-close:hover,
.window-control.is-close:focus-visible {
  background: var(--danger);
  color: var(--danger-foreground);
}

.window-glyph {
  width: 10px;
  height: 10px;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
