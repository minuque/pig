<template>
  <div class="workspace-hero">
    <h1 :id="titleId" class="hero-title">
      <span v-if="workspaceId">在</span>
      <DropdownMenu v-if="selectable" :modal="false">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="hero-picker"
            :disabled="!workspaces.length"
            :aria-label="`工作目录：${label}`"
          >
            <span class="hero-name">{{ label }}</span>
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
      <span v-else class="hero-name">{{ label }}</span>
      <span v-if="workspaceId">开始</span>
    </h1>
  </div>
</template>

<script lang="ts">
import { workspaceName } from "@features/session-nav/types.js";

/** 无选中目录时回退到选择提示；有路径时用最后一段。 */
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
  justify-content: center;
  min-width: 0;
}
.hero-title {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 0.3em;
  max-width: 100%;
  margin: 0;
  color: var(--ink);
  font-size: var(--text-heading-2);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-heading-2--line-height);
  letter-spacing: var(--tracking-heading-2);
  text-align: center;
}
.hero-picker {
  display: inline-flex;
  max-width: min(100%, 16rem);
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  text-decoration: underline dotted;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
  text-decoration-color: color-mix(in srgb, var(--ink) 32%, transparent);
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
.hero-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
