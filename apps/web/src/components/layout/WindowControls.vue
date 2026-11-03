<template>
  <div v-if="supported" class="window-controls">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="window-control"
          type="button"
          data-window-control="minimize"
          :aria-label="t('window.minimize')"
          @click="bridge?.minimize()"
        >
          <svg class="window-glyph" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 8h12" />
          </svg>
        </button>
      </TooltipTrigger>

      <TooltipContent side="bottom">{{ t("window.minimize") }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="window-control"
          type="button"
          :data-window-control="maximized ? 'restore' : 'maximize'"
          :aria-label="maximized ? t('window.restore') : t('window.maximize')"
          @click="bridge?.toggleMaximize()"
        >
          <svg v-if="maximized" class="window-glyph" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 6V2.5h7.5V10H11" />
            <rect x="2.5" y="6" width="7.5" height="7.5" rx="1.5" />
          </svg>

          <svg v-else class="window-glyph" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="2" width="12" height="12" rx="2" />
          </svg>
        </button>
      </TooltipTrigger>

      <TooltipContent side="bottom">
        {{ maximized ? t("window.restore") : t("window.maximize") }}
      </TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="window-control is-close"
          type="button"
          data-window-control="close"
          :aria-label="t('window.close')"
          @click="bridge?.close()"
        >
          <svg class="window-glyph" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3l10 10M13 3l-10 10" />
          </svg>
        </button>
      </TooltipTrigger>

      <TooltipContent side="bottom">{{ t("window.close") }}</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useWindowMaximized } from "@components/layout/hooks/use-window-maximized.js"
import { useI18n } from "@i18n/index.js"

/** macOS 保留原生红绿灯，Linux 走原生边框：只有 Windows 自画窗控。 */
const platform = document.documentElement.dataset.pigDesktopPlatform
const supported = platform === "win32"
const bridge = supported ? window.pigDesktop?.window : undefined
const { t } = useI18n()
/* 平台不支持自画窗控时也要订阅：最大化状态还要写进布局用的 html 属性。 */
const maximized = useWindowMaximized()
</script>

<style scoped>
.window-controls {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  z-index: var(--z-window-controls);
  display: flex;
  align-items: center;
  gap: 2px;
  height: var(--titlebar-inset);
  padding-inline: var(--space-xxs);
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.window-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--size-window-control);
  height: calc(var(--titlebar-inset) - 12px);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--foreground-muted);
  cursor: default;
}

.window-control:hover,
.window-control:focus-visible {
  background: var(--hover-quiet);
  color: var(--toolbar-foreground);
}

.window-control:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.window-control.is-close {
  margin-inline-start: var(--space-xxs);
}

.window-control.is-close:hover,
.window-control.is-close:focus-visible {
  background: var(--danger);
  color: var(--white);
}

.window-glyph {
  width: var(--size-window-glyph);
  height: var(--size-window-glyph);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
