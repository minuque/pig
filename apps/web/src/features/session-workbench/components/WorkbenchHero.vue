<template>
  <div class="workbench-hero">
    <h1 :id="titleId" class="hero-title">
      <span v-if="workspaceId">在</span>
      <DropdownMenu v-if="selectable" :modal="false">
        <DropdownMenuTrigger as-child>
          <button type="button" class="hero-picker" :aria-label="`工作目录：${label}`">
            <span class="hero-name">{{ label }}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          :side-offset="6"
          class="workbench-hero-menu"
          aria-label="选择工作目录"
        >
          <DropdownMenuItem
            v-for="item in workspaces"
            :key="item"
            :title="item"
            :class="{ 'workbench-hero-option-active': item === workspaceId }"
            @select="workspaceId = item"
          >
            <span class="workbench-hero-option-label">{{ workspaceName(item) }}</span>
          </DropdownMenuItem>
          <div v-if="workspaces.length" class="workbench-hero-menu-rule" role="separator"></div>
          <DropdownMenuItem :disabled="adding" @select="emit('add')">
            <FolderPlus :size="14" aria-hidden="true" />
            添加本地目录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span v-else class="hero-name">{{ label }}</span>
      <span v-if="workspaceId">开始</span>
    </h1>
  </div>
</template>

<script lang="ts">
import { workspaceName } from "@features/session-nav/format.js";

/** 无选中目录时回退到选择提示；有路径时用最后一段。 */
export function workbenchHeroLabel(workspaceId: string | undefined): string {
  return workspaceId ? workspaceName(workspaceId) : "选择工作目录";
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import { FolderPlus } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";

withDefaults(
  defineProps<{
    titleId: string;
    workspaces: readonly string[];
    /** 空 Session 已绑定 cwd，标题只展示不切换。 */
    selectable?: boolean;
    adding?: boolean;
  }>(),
  { selectable: true, adding: false },
);

const emit = defineEmits<{
  add: [];
}>();

const workspaceId = defineModel<string | undefined>("workspaceId");
const label = computed(() => workbenchHeroLabel(workspaceId.value));
</script>

<style scoped>
.workbench-hero {
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
  font-weight: var(--font-weight-regular);
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
  border-bottom: 1px dotted color-mix(in srgb, var(--ink) 38%, transparent);
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  cursor: pointer;
}
.hero-picker:hover:not(:disabled) {
  border-bottom-color: color-mix(in srgb, var(--ink) 72%, transparent);
}
.hero-picker:not(:disabled):active {
  transform: none;
}
.hero-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style>
/* 菜单经 Portal 挂到 body，scoped 选不中 */
.workbench-hero-menu {
  min-width: 10rem;
  max-width: 16rem;
}
.workbench-hero-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workbench-hero-option-active {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.workbench-hero-menu-rule {
  height: 1px;
  margin: var(--spacing-xxs) 0;
  background: var(--hairline);
}
</style>
