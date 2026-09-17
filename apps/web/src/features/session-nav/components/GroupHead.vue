<template>
  <div class="group-head" :class="{ 'is-open': !collapsed }">
    <button class="group-toggle" type="button" :aria-expanded="!collapsed" @click="emit('toggle')">
      <span v-if="kind === 'directory'" class="mark" :class="{ 'is-open': !collapsed }">
        <Folder v-if="collapsed" class="size-icon" />
        <FolderOpen v-else class="size-icon" />
      </span>

      <Pin
        v-else-if="kind === 'pinned'"
        class="size-icon mark"
        :class="{ 'is-open': !collapsed }"
      />

      <Clock v-else class="size-icon mark" :class="{ 'is-open': !collapsed }" />
      <span class="group-name">{{ name }}</span>
    </button>

    <span v-if="showGrouping || (kind === 'directory' && !collapsed)" class="trail">
      <DropdownMenu v-if="showGrouping" :modal="false">
        <DropdownMenuTrigger as-child>
          <button
            class="group-options press-scale"
            type="button"
            title="侧栏分组"
            aria-label="侧栏分组"
            @pointerdown.stop
            @click.stop
          >
            <Settings2 class="size-icon" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" :side-offset="4">
          <DropdownMenuItem
            v-for="option in groupingOptions"
            :key="option.value"
            class="group-head-option"
            @select="emit('setGrouping', option.value)"
          >
            <span>{{ option.label }}</span>

            <span class="group-head-option-check" aria-hidden="true">
              <Check v-if="grouping === option.value" class="size-icon" />
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        v-if="kind === 'directory' && (showGrouping || !collapsed)"
        class="group-new"
        :class="{ 'hover-only': !showGrouping }"
        type="button"
        title="新会话"
        aria-label="在此目录新建会话"
        @click.stop="emit('create')"
      >
        <MessageCirclePlus class="size-icon" />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { Check, Clock, Folder, FolderOpen, MessageCirclePlus, Pin, Settings2 } from "@lucide/vue"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import type { SidebarGrouping } from "@features/session-nav/type.js"

const groupingOptions = [
  { value: "project", label: "按目录" },
  { value: "updated", label: "按更新时间" },
] as const satisfies readonly { value: SidebarGrouping; label: string }[]

withDefaults(
  defineProps<{
    name: string
    collapsed?: boolean
    kind?: "directory" | "time" | "pinned"
    grouping?: SidebarGrouping
    showGrouping?: boolean
  }>(),
  { kind: "directory", showGrouping: false },
)

const emit = defineEmits<{
  toggle: []
  create: []
  setGrouping: [grouping: SidebarGrouping]
}>()
</script>

<style scoped>
.group-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
  line-height: 0;
}

.group-head:hover {
  background: var(--hover-quiet);
}

.group-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  line-height: 0;
  text-align: start;
}

.mark {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--ink-faint);
  transition: color var(--duration-fast) var(--ease-smooth);
}

.group-head:hover .mark {
  color: var(--ink-muted);
}

.mark.is-open,
.group-head:hover .mark.is-open {
  color: var(--primary);
}

.group-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trail {
  display: flex;
  flex: none;
  align-items: center;
  align-self: center;
  gap: var(--spacing-xxs);
  min-width: var(--size-icon);
}

.group-options,
.group-new {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  line-height: 0;
}

.group-options:hover,
.group-options:focus-visible,
.group-new:hover,
.group-new:focus-visible {
  color: var(--ink);
}

@media (hover: hover) {
  .group-new.hover-only {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .group-head:is(:hover, :focus-within) .group-new.hover-only,
  .group-new.hover-only:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }
}

.group-head.is-open .group-name {
  color: var(--ink);
}
</style>

<style>
/* 菜单经 Portal 挂到 body，scoped 选不中 */
.group-head-option {
  justify-content: space-between;
}

.group-head-option-check {
  display: flex;
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
}
</style>
