<template>
  <div class="nav-footer">
    <button class="footer-settings press-scale" type="button" @click="emit('settings')">
      <span class="footer-glyph">
        <Settings />
      </span>

      <span>设置</span>
    </button>

    <Tooltip>
      <TooltipTrigger as-child>
        <a
          class="footer-help press-scale"
          href="https://github.com/minuque/pig"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="文档"
        >
          <CircleHelp />
        </a>
      </TooltipTrigger>

      <TooltipContent>文档</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { CircleHelp, Settings } from "@lucide/vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

const emit = defineEmits<{
  settings: []
}>()
</script>

<style scoped>
.nav-footer {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--nav-inline, var(--spacing-xs));
  border-top: var(--border-width) solid var(--border-subtle);
}

.footer-settings,
.footer-help {
  border: 0;
  background: transparent;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}

.footer-settings:hover {
  background: var(--interaction-hover);
  color: var(--ink);
}

.footer-help:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.footer-settings {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
}

/* 前置图标槽，和会话行的 icon 列对齐 */
.footer-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
}

.footer-glyph svg,
.footer-help svg {
  width: var(--size-icon);
  height: var(--size-icon);
}

.footer-help {
  display: grid;
  flex: none;
  place-items: center;
  padding: var(--icon-button-pad);
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
}

@media (prefers-reduced-motion: reduce) {
  .footer-settings,
  .footer-help {
    transition: none;
  }
}
</style>
