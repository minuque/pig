<template>
  <div class="startup-wait">
    <div class="drag-strip" aria-hidden="true"></div>
    <div class="startup-content">
      <img class="startup-logo" src="/logo.png" alt="" width="128" height="128" />
      <p class="startup-status" role="status" aria-live="polite">{{ phaseLabel }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { StartupPhase } from "./types.js";

const props = defineProps<{
  phase: StartupPhase;
}>();

const PHASE_LABEL: Record<StartupPhase, string> = {
  authorizing: "正在验证启动凭证",
  connecting: "正在连接 Pi",
  preparing: "正在准备工作台",
};

const phaseLabel = computed(() => PHASE_LABEL[props.phase]);
</script>

<style scoped>
.startup-wait {
  position: fixed;
  z-index: var(--z-modal);
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--surface);
  color: var(--ink);
  -webkit-app-region: no-drag;
}
.startup-wait-leave-active {
  pointer-events: none;
  transition: opacity 420ms var(--ease-smooth);
}
.startup-wait-leave-to {
  opacity: 0;
}
.drag-strip {
  position: absolute;
  z-index: 1;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
}
.startup-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}
.startup-wait-leave-active .startup-content {
  transition:
    opacity var(--duration-fast) var(--ease-smooth),
    transform var(--duration-slow) var(--ease-out);
}
.startup-wait-leave-to .startup-content {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
.startup-logo {
  display: block;
  width: clamp(96px, 15vw, 128px);
  height: auto;
  -webkit-app-region: no-drag;
}
.startup-status {
  min-height: 1rem;
  margin: 0;
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  line-height: var(--text-caption-mono--line-height);
  letter-spacing: var(--tracking-caption-mono);
}
:global(html[data-pig-desktop-platform="darwin"]) .startup-wait,
:global(html[data-pig-desktop-platform="win32"]) .startup-wait {
  background: color-mix(in srgb, var(--surface) 28%, transparent);
}
@media (prefers-reduced-transparency: reduce) {
  .startup-wait {
    background: var(--surface);
  }
}
@media (prefers-reduced-motion: reduce) {
  .startup-wait-leave-active,
  .startup-wait-leave-active .startup-content {
    transition: none;
  }
}
</style>
