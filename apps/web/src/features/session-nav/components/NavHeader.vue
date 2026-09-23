<template>
  <div class="logo-row">
    <RouterLink to="/" class="logo-mark">
      <img src="/pwa-icon-192.png" alt="" width="22" height="22" />
    </RouterLink>

    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="collapse-toggle"
          type="button"
          aria-label="折叠侧边栏"
          @click="emit('toggle')"
        >
          <PanelLeft class="size-icon" />
        </button>
      </TooltipTrigger>

      <TooltipContent>折叠侧边栏</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router"
import { PanelLeft } from "@lucide/vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

const emit = defineEmits<{
  toggle: []
}>()
</script>

<style scoped>
html[data-pig-desktop-platform] .logo-row {
  background: var(--sidebar);
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .logo-row :is(button, a) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.logo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--size-nav-rail);
}

html[data-pig-desktop-platform="win32"] .logo-row {
  min-height: var(--titlebar-inset);
}

.logo-mark,
.collapse-toggle {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}

.logo-mark {
  width: var(--size-nav-rail);
  height: var(--size-nav-rail);
}

.logo-mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

:is(.logo-mark, .collapse-toggle):hover {
  background: var(--hover-quiet);
  color: var(--ink);
}
</style>
