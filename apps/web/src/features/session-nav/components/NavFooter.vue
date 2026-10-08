<template>
  <div class="nav-footer">
    <button class="footer-settings press-scale" type="button" @click="emit('settings')">
      <span class="footer-glyph">
        <Settings />
      </span>

      <span>设置</span>
    </button>

    <DropdownMenu :modal="false">
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <button class="footer-help press-scale" type="button" aria-label="帮助">
              <CircleHelp />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>

        <TooltipContent>帮助</TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="top" align="end" :side-offset="8">
        <DropdownMenuItem class="help-item" :aria-pressed="soundOn" @select="toggleSound()">
          <span class="help-lead">
            <Volume2 v-if="soundOn" />
            <VolumeX v-else />
            音效
          </span>

          <span class="help-state">{{ soundOn ? "开" : "关" }}</span>
        </DropdownMenuItem>

        <DropdownMenuItem class="help-item" :aria-pressed="isDark" @select="toggleTheme()">
          <span class="help-lead">
            <Moon v-if="isDark" />
            <Sun v-else />
            主题
          </span>

          <span class="help-state">{{ isDark ? "深色" : "浅色" }}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem class="help-item" as-child>
          <a href="https://github.com/minuque/pig" target="_blank" rel="noopener noreferrer">
            <span class="help-lead">
              <BookOpen />
              文档
            </span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { BookOpen, CircleHelp, Moon, Settings, Sun, Volume2, VolumeX } from "@lucide/vue"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useSound } from "@features/click-sound/index.js"
import { useColorScheme } from "@features/theme/index.js"

const emit = defineEmits<{
  settings: []
}>()
const { enabled: soundOn, toggle: toggleSound } = useSound()
const { isDark, toggle: toggleTheme } = useColorScheme()
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

.footer-help:hover,
.footer-help[data-state="open"] {
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

<style>
/* 菜单经 Portal 挂到 body，scoped 选不中 */
.help-item svg {
  width: var(--size-icon-2xs);
  height: var(--size-icon-2xs);
}

.help-lead {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.help-state {
  margin-inline-start: auto;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
