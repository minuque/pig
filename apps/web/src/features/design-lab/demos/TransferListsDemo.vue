<template>
  <Story title="TransferLists">
    <Variant title="分组拖拽与边界取消">
      <div ref="frame" class="transfer-frame">
        <TransferListsRoot
          v-slot="{ state }"
          class="transfer-root"
          :value="lists"
          :order="() => ['pinned', 'inbox']"
          :reorderable="(list) => list === 'pinned'"
          :accepts="(_key, from, to) => to === 'pinned' || to !== from"
          :disabled="(key) => key === 'i4'"
          :bounds="() => frame ?? undefined"
          :item-label="itemTitle"
          :list-label="listLabel"
          @value-change="lists = $event"
        >
          <section v-for="section in SECTIONS" :key="section.id" class="transfer-section">
            <h4 class="section-head">{{ section.label }}</h4>

            <TransferList :value="section.id">
              <template #render="{ props: part }">
                <ul v-bind="part" class="section-list">
                  <TransferItem
                    v-for="id in state.lists[section.id] ?? []"
                    :key="id"
                    :value="id"
                    class="transfer-item"
                  >
                    <PinIcon v-if="section.id === 'pinned'" class="item-icon size-icon-sm" />
                    <span class="item-label">{{ itemTitle(id) }}</span>
                    <span class="item-meta">{{ itemMeta(id) }}</span>
                  </TransferItem>
                </ul>
              </template>
            </TransferList>
          </section>
        </TransferListsRoot>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from "vue"
import { PinIcon } from "@components/icons/index.js"
import {
  TransferItem,
  TransferList,
  TransferListsRoot,
  type TransferLists,
} from "@pig/ui/transfer-lists"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"

const SECTIONS = [
  { id: "pinned", label: "置顶" },
  { id: "inbox", label: "收件箱" },
] as const

const ITEMS: Record<string, { title: string; meta: string }> = {
  p1: { title: "发版清单", meta: "置顶" },
  p2: { title: "拖拽波纹手感", meta: "置顶" },
  p3: { title: "设计变量巡检", meta: "置顶" },
  i1: { title: "Banner 文案收敛", meta: "12m" },
  i2: { title: "gateway 断线重连", meta: "25m" },
  i3: { title: "Select 组件对齐", meta: "1h" },
  i4: { title: "运行中任务（锁定）", meta: "运行中" },
}

const frame = useTemplateRef("frame")
const lists = ref<TransferLists>({
  pinned: ["p1", "p2", "p3"],
  inbox: ["i1", "i2", "i3", "i4"],
})

const itemTitle = (id: string) => ITEMS[id]?.title ?? id
const itemMeta = (id: string) => ITEMS[id]?.meta ?? ""
const listLabel = (id: string) => SECTIONS.find((section) => section.id === id)?.label ?? id
</script>

<style scoped>
.transfer-frame {
  max-inline-size: 320px;
  padding: var(--space-sm);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background: var(--bg);
  background-clip: padding-box;
}

.transfer-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.transfer-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.section-head {
  margin: 0;
  padding-inline: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.section-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-block-size: var(--control-lg);
  margin: 0;
  padding: var(--space-2xs);
  border-radius: var(--radius-control);
  list-style: none;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.section-list[data-drop-target] {
  background: var(--bg-hover);
}

.transfer-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-block-size: var(--control-md);
  padding: var(--space-2xs) var(--space-xs);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg);
  background-clip: padding-box;
  list-style: none;
  user-select: none;
}

.transfer-item[data-draggable] {
  cursor: pointer;
}

.transfer-item[data-draggable]:hover {
  background: var(--bg-hover);
}

.transfer-item:not([data-draggable]) {
  color: var(--fg-muted);
}

.transfer-item[data-drag-preview] {
  background: var(--bg-raised);
  box-shadow: var(--shadow-popover);
}

.item-icon {
  flex: none;
  color: var(--fg-muted);
}

.item-label {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  font-size: var(--text-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  flex: none;
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}
</style>
