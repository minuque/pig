<template>
  <Story title="TransferLists">
    <Variant title="分组拖拽、虚框避让与已整理落位">
      <div ref="frame" class="transfer-frame">
        <TransferListsRoot
          v-slot="{ state }"
          class="transfer-root"
          :value="lists"
          :order="() => ['pinned', 'inbox', 'settled']"
          :reorderable="(list) => list === 'pinned'"
          :accepts="(_key, from, to) => to === 'pinned' || to !== from"
          :disabled="(key) => key === 'i4'"
          :bounds="() => frame ?? undefined"
          :item-label="itemTitle"
          :list-label="listLabel"
          @value-change="lists = $event"
        >
          <section v-for="section in SECTIONS" :key="section.id" class="transfer-section">
            <TransferList :value="section.id">
              <template #render="{ props: part }">
                <div v-bind="part" class="section-box">
                  <button
                    v-if="section.id === 'settled'"
                    type="button"
                    class="section-toggle"
                    :class="{ 'is-dragging': Boolean(state.moving) }"
                    :data-target="state.to === 'settled' ? '' : undefined"
                    @click="settledOpen = !settledOpen"
                  >
                    <span class="section-head">{{ section.label }}</span>
                    <span class="section-count">{{ (state.lists.settled ?? []).length }}</span>
                    <ChevronDownIcon
                      class="size-icon-sm section-chevron"
                      :class="{ 'is-closed': !settledOpen }"
                    />
                  </button>

                  <h4 v-else class="section-head">{{ section.label }}</h4>

                  <div
                    v-if="
                      section.id === 'settled' &&
                      state.moving &&
                      (!settledOpen || (state.lists.settled ?? []).length === 0)
                    "
                    data-drop-hint-box
                    class="settled-drop-hint"
                    :class="{ 'is-target': state.to === 'settled' }"
                    aria-hidden="true"
                  >
                    {{ section.label }}
                  </div>

                  <ul
                    v-show="section.id !== 'settled' || settledOpen"
                    class="section-list"
                    :class="{
                      'is-drop': Boolean(state.moving),
                      'is-target': state.to === section.id,
                    }"
                  >
                    <TransferItem
                      v-for="id in state.lists[section.id] ?? []"
                      :key="id"
                      :value="id"
                      class="transfer-item"
                      :class="{ 'is-slim': section.id === 'settled' }"
                    >
                      <PinIcon v-if="section.id === 'pinned'" class="item-icon size-icon-sm" />
                      <span class="item-label">{{ itemTitle(id) }}</span>
                      <span class="item-meta">{{ itemMeta(id) }}</span>
                    </TransferItem>
                  </ul>
                </div>
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
import { ChevronDownIcon, PinIcon } from "@components/icons/index.js"
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
  { id: "settled", label: "已整理" },
] as const

const ITEMS: Record<string, { title: string; meta: string }> = {
  p1: { title: "发版清单", meta: "置顶" },
  p2: { title: "拖拽波纹手感", meta: "置顶" },
  p3: { title: "设计变量巡检", meta: "置顶" },
  i1: { title: "Banner 文案收敛", meta: "12m" },
  i2: { title: "gateway 断线重连", meta: "25m" },
  i3: { title: "Select 组件对齐", meta: "1h" },
  i4: { title: "运行中任务（锁定）", meta: "运行中" },
  s1: { title: "toast 关闭按钮", meta: "1d" },
  s2: { title: "图标库切换到 lucide", meta: "2d" },
}

const frame = useTemplateRef("frame")
const settledOpen = ref(false)
const lists = ref<TransferLists>({
  pinned: ["p1", "p2", "p3"],
  inbox: ["i1", "i2", "i3", "i4"],
  settled: ["s1", "s2"],
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

.transfer-section,
.section-box {
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

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  inline-size: 100%;
  block-size: var(--control-md);
  padding-inline: var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  cursor: default;
}

.section-toggle .section-head {
  padding-inline: 0;
  color: inherit;
}

.section-toggle.is-dragging {
  color: var(--fg-secondary);
}

.section-toggle[data-target] {
  color: var(--accent-text);
}

.section-count {
  margin-inline-start: auto;
  font-weight: var(--font-weight-normal);
  font-variant-numeric: tabular-nums;
}

.section-chevron {
  transition: rotate var(--duration-fast) var(--ease-out);
}

.section-chevron.is-closed {
  rotate: -90deg;
}

.settled-drop-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: var(--control-lg);
  margin-inline: var(--space-2xs);
  border: var(--border-width) dashed var(--border-strong);
  border-radius: var(--radius-control);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  pointer-events: none;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.settled-drop-hint.is-target {
  border-color: var(--accent-solid);
  background: var(--info-subtle);
  color: var(--accent-text);
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

.section-list.is-drop:empty {
  border: var(--border-width) dashed var(--border-strong);
}

.section-list.is-drop.is-target:empty {
  border-color: var(--accent-solid);
  background: var(--info-subtle);
}

.transfer-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-block-size: var(--control-lg);
  padding: var(--space-2xs) var(--space-xs);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg);
  background-clip: padding-box;
  list-style: none;
  user-select: none;
}

.transfer-item.is-slim {
  min-block-size: var(--control-lg);
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

.transfer-item[data-dragging] {
  border-style: dashed;
  border-color: var(--accent-solid);
  background: var(--info-subtle);
  opacity: 0.6;
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

@media (prefers-reduced-motion: reduce) {
  .section-chevron,
  .settled-drop-hint,
  .section-list {
    transition: none;
  }
}
</style>
