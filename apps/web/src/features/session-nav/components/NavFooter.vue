<template>
  <div class="nav-footer">
    <button class="footer-settings press-scale" type="button" @click="emit('settings')">
      <Settings class="size-icon" />
      <span>设置</span>
    </button>

    <DropdownMenu :modal="false">
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <button class="footer-help press-scale" type="button" aria-label="帮助">
              <CircleHelp class="size-icon" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>

        <TooltipContent>帮助</TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="top" align="end" :side-offset="8" class="nav-help-menu">
        <DropdownMenuItem class="nav-help-item" @select="emit('search')">
          <span>搜索会话</span>
          <span class="nav-help-kbd">Ctrl K</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div class="nav-help-note">
          <span>发送</span>
          <span class="nav-help-kbd">Enter</span>
        </div>

        <div class="nav-help-note">
          <span>停止</span>
          <span class="nav-help-kbd">Esc</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { CircleHelp, Settings } from "@lucide/vue"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

const emit = defineEmits<{
  settings: []
  search: []
}>()
</script>

<style scoped>
.nav-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--nav-inline, var(--spacing-xs));
  border-top: var(--border-width) solid var(--border-subtle);
}

.footer-settings,
.footer-help {
  border: 0;
  background: transparent;
  color: var(--ink);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}

.footer-settings:hover,
.footer-help:hover,
.footer-help[data-state="open"] {
  background: var(--hover-quiet);
}

.footer-settings {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
}

.footer-help {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border-radius: var(--radius-full);
}

@media (prefers-reduced-motion: reduce) {
  .footer-settings,
  .footer-help {
    transition: none;
  }
}
</style>

<style>
.nav-help-item {
  justify-content: space-between;
  gap: var(--spacing-md);
}

.nav-help-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-height: 1.75rem;
  padding: var(--spacing-xxs) var(--spacing-xs);
  color: var(--ink-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}

.nav-help-kbd {
  flex: none;
  color: var(--ink-faint);
  font: var(--text-caption-mono) / var(--text-caption-mono--line-height) var(--font-mono);
}
</style>
