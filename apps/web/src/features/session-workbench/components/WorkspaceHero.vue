<template>
  <div class="workspace-hero">
    <h1 :id="titleId" class="hero-title">
      <DropdownMenu v-if="selectable" :modal="false">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="hero-picker"
            :disabled="!workspaces.length"
            :aria-label="`工作目录：${label}`"
          >
            <span class="hero-picker-name">{{ label }}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" :side-offset="6" aria-label="选择工作目录">
          <DropdownMenuItem
            v-for="item in workspaces"
            :key="item.canonicalPath"
            @select="workspaceId = item.canonicalPath"
          >
            {{ workspaceName(item.canonicalPath) }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span v-else class="hero-picker-name">{{ label }}</span>
    </h1>
    <p v-if="workspaceId" class="hero-path" :title="workspaceId">{{ workspaceId }}</p>
  </div>
</template>

<script lang="ts">
import { workspaceName } from "@features/session-nav/types.js";

/** 无选中目录时回退到选择提示；有路径时用最后一段作为标题。 */
export function workspaceHeroLabel(workspaceId: string | undefined): string {
  return workspaceId ? workspaceName(workspaceId) : "选择工作目录";
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import type { LocalWorkspace } from "@features/session-nav/types.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";

withDefaults(
  defineProps<{
    titleId: string;
    workspaces: readonly LocalWorkspace[];
    /** 空 Session 已绑定 cwd，标题只展示不切换。 */
    selectable?: boolean;
  }>(),
  { selectable: true },
);

const workspaceId = defineModel<string | undefined>("workspaceId");
const label = computed(() => workspaceHeroLabel(workspaceId.value));
</script>

<style scoped>
.workspace-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.hero-title {
  margin: 0;
  max-width: 100%;
  text-align: center;
  font-size: var(--text-display-2);
  font-weight: var(--font-weight-bold);
  line-height: var(--text-display-2--line-height);
  letter-spacing: var(--tracking-display-2);
}
.hero-picker {
  display: inline-flex;
  max-width: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  text-decoration: underline dotted;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.18em;
  text-decoration-color: color-mix(in srgb, var(--ink) 28%, transparent);
  cursor: pointer;
}
.hero-picker:hover:not(:disabled) {
  text-decoration-color: var(--ink);
}
.hero-picker:not(:disabled):active {
  transform: none;
}
.hero-picker:disabled {
  cursor: default;
  opacity: 1;
}
.hero-picker-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hero-path {
  margin: var(--spacing-xs) 0 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-align: center;
}
@media (max-width: 900px) {
  .hero-title {
    font-size: var(--text-heading-1);
    line-height: var(--text-heading-1--line-height);
    letter-spacing: var(--tracking-heading-1);
  }
}
</style>
