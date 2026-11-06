<template>
  <div class="workbench-hero">
    <h1 v-if="workspaceId || ready" :id="titleId" class="hero-title">
      <span v-if="workspaceId">{{ t("hero.ask") }}</span>

      <span class="hero-target">
        <DropdownMenu v-if="selectable" :modal="false">
          <DropdownMenuTrigger as-child>
            <button type="button" class="hero-picker">
              <span class="hero-name">{{ label }}</span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="center" :side-offset="6" class="workbench-hero-menu">
            <DropdownMenuItem
              v-for="item in workspaces"
              :key="item"
              :title="item"
              :class="{ 'workbench-hero-option-active': item === workspaceId }"
              @select="workspaceId = item"
            >
              <span class="workbench-hero-option-label">{{ workspaceName(item) }}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator v-if="workspaces.length" />

            <DropdownMenuItem :disabled="adding" @select="emit('add')">
              <AddFolderIcon :size="14" />
              {{ t("hero.addDir") }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span v-else class="hero-name">{{ label }}</span>
        <span class="hero-suffix">{{ suffix }}</span>
      </span>
    </h1>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { workspaceName } from "@features/session-nav/index.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { AddFolderIcon } from "@components/icons/index.js"

withDefaults(
  defineProps<{
    titleId: string
    workspaces: readonly string[]
    /** 空 Session 已绑定 cwd，标题只展示不切换。 */
    selectable?: boolean
    adding?: boolean
    /** 未就绪时不把缺目录画成引导。 */
    ready?: boolean
  }>(),
  { selectable: true, adding: false, ready: true },
)

const { t } = useI18n()
const emit = defineEmits<{
  add: []
}>()
const workspaceId = defineModel<string | undefined>("workspaceId")
const label = computed(() =>
  workspaceId.value ? workspaceName(workspaceId.value) : t("hero.pickDir"),
)
const suffix = computed(() => t(workspaceId.value ? "hero.askSuffix" : "hero.pickSuffix"))
</script>

<style scoped>
.workbench-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
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
  color: var(--contrast-foreground);
  font-size: var(--text-heading-2);
  font-weight: var(--font-weight-normal);
  line-height: var(--text-heading-2--line-height);
  letter-spacing: var(--text-heading-2--letter-spacing);
  text-align: center;
}

/* 项目名即选择器：加粗，悬停或菜单打开时出下划线 */
.hero-picker {
  display: inline-flex;
  max-width: min(100%, 16rem);
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: var(--font-weight-medium);
  letter-spacing: inherit;
  line-height: inherit;
  vertical-align: bottom;
  text-underline-offset: 4px;
  cursor: pointer;
}

.hero-picker:hover,
.hero-picker[data-state="open"] {
  text-decoration: underline;
}

.hero-picker:active {
  transform: none;
}

/* 项目名与句尾连成一块，换行时不拆开 */
.hero-target {
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  max-width: 100%;
}

/* 句尾自带的前导空格要留住 */
.hero-suffix {
  flex: none;
  white-space: pre;
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
  max-width: 16rem;
}

.workbench-hero-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-hero-option-active {
  background: var(--hover-tint);
}
</style>
