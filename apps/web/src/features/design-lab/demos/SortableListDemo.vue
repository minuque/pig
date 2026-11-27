<template>
  <Story title="SortableList">
    <Variant title="纵向卡片（支持键盘排序）">
      <SortableList
        v-slot="{ state }"
        class="vertical-list"
        aria-label="纵向排序示例"
        :value="verticalOrder"
        :item-label="verticalLabel"
        @value-change="verticalOrder = $event"
      >
        <SortableListItem v-for="id in state.order" :key="id" :value="id" class="vertical-row">
          <SortableListHandle :value="id" class="row-handle" aria-label="拖拽排序">
            <GripVerticalIcon class="size-icon-sm" />
          </SortableListHandle>

          <span class="row-label">{{ verticalLabel(id) }}</span>
          <span class="row-meta">{{ verticalMeta(id) }}</span>
        </SortableListItem>
      </SortableList>
    </Variant>

    <Variant title="横向图标栏（向上抬起）">
      <SortableList
        v-slot="{ state }"
        class="dock-list"
        aria-label="横向图标排序示例"
        orientation="horizontal"
        density="icon"
        :value="dockOrder"
        :item-label="dockLabel"
        @value-change="dockOrder = $event"
      >
        <SortableListItem v-for="id in state.order" :key="id" :value="id" class="dock-item">
          <SortableListHandle :value="id" class="dock-tile" :aria-label="dockLabel(id)">
            <component :is="dockIcon(id)" class="size-icon-lg" />
          </SortableListHandle>
        </SortableListItem>
      </SortableList>
    </Variant>

    <Variant title="右对齐向左抬起">
      <SortableList
        v-slot="{ state }"
        class="right-list"
        aria-label="右对齐待发队列示例"
        lift-side="start"
        :value="rightOrder"
        :item-label="rightLabel"
        @value-change="rightOrder = $event"
      >
        <SortableListItem v-for="id in state.order" :key="id" :value="id" class="bubble-row">
          <SortableListHandle :value="id" class="row-handle" aria-label="拖拽排序">
            <GripVerticalIcon class="size-icon-sm" />
          </SortableListHandle>

          <span class="bubble-card">{{ rightLabel(id) }}</span>
        </SortableListItem>
      </SortableList>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref, type Component } from "vue"
import {
  FolderIcon,
  GitBranchIcon,
  GripVerticalIcon,
  LayersIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  SquareTerminalIcon,
} from "@components/icons/index.js"
import { SortableList, SortableListHandle, SortableListItem } from "@pig/ui/sortable-list"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"

const VERTICAL_ITEMS: Record<string, { title: string; code: string }> = {
  v1: { title: "手形与抓手光标", code: "01" },
  v2: { title: "抬起并收拢原槽位", code: "02" },
  v3: { title: "15% 落点线贴缝滑移", code: "03" },
  v4: { title: "邻项 A×0.7ⁿ 波纹让位", code: "04" },
  v5: { title: "落位回弹与 Escape 取消", code: "05" },
}

const DOCK_ITEMS: Record<string, { label: string; icon: Component }> = {
  terminal: { label: "终端", icon: SquareTerminalIcon },
  search: { label: "搜索", icon: SearchIcon },
  branch: { label: "分支", icon: GitBranchIcon },
  folder: { label: "文件", icon: FolderIcon },
  layers: { label: "层级", icon: LayersIcon },
  sparkles: { label: "助手", icon: SparklesIcon },
  settings: { label: "设置", icon: SettingsIcon },
}

const RIGHT_ITEMS: Record<string, string> = {
  q1: "先补齐设计实验室预览页",
  q2: "校验样式令牌与文件行数上限",
  q3: "确认横向与纵向抬起互不遮挡",
  q4: "验证减弱动画下仅保留指示线",
}

const verticalOrder = ref(["v1", "v2", "v3", "v4", "v5"])
const dockOrder = ref(["terminal", "search", "branch", "folder", "layers", "sparkles", "settings"])
const rightOrder = ref(["q1", "q2", "q3", "q4"])

const verticalLabel = (id: string) => VERTICAL_ITEMS[id]?.title ?? id
const verticalMeta = (id: string) => VERTICAL_ITEMS[id]?.code ?? ""
const dockLabel = (id: string) => DOCK_ITEMS[id]?.label ?? id
const dockIcon = (id: string) => DOCK_ITEMS[id]?.icon ?? SquareTerminalIcon
const rightLabel = (id: string) => RIGHT_ITEMS[id] ?? id
</script>

<style scoped>
.vertical-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-inline-size: 360px;
}

.vertical-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-block-size: var(--control-lg);
  padding: var(--space-2xs) var(--space-sm) var(--space-2xs) var(--space-xs);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background: var(--bg);
  background-clip: padding-box;
  list-style: none;
}

.vertical-row:is([data-drag-preview], [data-keyboard-dragging]) {
  background: var(--bg-raised);
  box-shadow: var(--shadow-popover);
}

.row-handle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  inline-size: var(--control-xs);
  block-size: var(--control-xs);
  border-radius: var(--radius-control);
  color: var(--fg-muted);
}

.row-handle:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.row-handle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.row-label {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  color: var(--fg);
  font-size: var(--text-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  flex: none;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.dock-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--space-xs);
  width: fit-content;
  padding-block-start: var(--space-lg);
}

.dock-item {
  display: flex;
  flex: none;
  list-style: none;
}

.dock-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--control-lg);
  block-size: var(--control-lg);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg);
  background-clip: padding-box;
  color: var(--fg-secondary);
}

.dock-tile:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.dock-tile:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.dock-item:is([data-drag-preview], [data-keyboard-dragging]) .dock-tile {
  background: var(--bg-raised);
  color: var(--fg);
  box-shadow: var(--shadow-popover);
}

.right-list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
  max-inline-size: 420px;
}

.bubble-row {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  max-inline-size: 100%;
  list-style: none;
}

.bubble-card {
  padding: var(--space-xs) var(--space-sm);
  border: var(--border-width) dashed var(--border-strong);
  border-radius: var(--radius-card);
  background: var(--bg);
  background-clip: padding-box;
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.bubble-row:is([data-drag-preview], [data-keyboard-dragging]) .bubble-card {
  background: var(--bg-raised);
  box-shadow: var(--shadow-popover);
}
</style>
