<template>
  <Dialog v-model:open="open">
    <DialogContent
      v-if="tool"
      class="tool-dialog"
      max-width="min(88vw, 44rem)"
      initial-focus="content"
    >
      <div class="tool-dialog-head">
        <DialogTitle class="tool-dialog-title">{{ tool.name }}</DialogTitle>

        <p v-if="tool.title && tool.title !== tool.name" class="tool-dialog-subtitle">
          {{ tool.title }}
        </p>

        <div class="tool-badges">
          <Badge size="s" variant="soft" color="neutral">{{ exposure }}</Badge>

          <Badge v-for="hint in hints" :key="hint.key" size="s" variant="soft" :color="hint.color">
            {{ t(hint.label) }}
          </Badge>
        </div>

        <DialogDescription v-if="tool.description" class="tool-dialog-desc">
          {{ tool.description }}
        </DialogDescription>

        <DialogDescription v-else class="tool-dialog-empty">
          {{ t("settings.mcp.tool.noDescription") }}
        </DialogDescription>
      </div>

      <section class="tool-section">
        <h3 class="section-title">{{ t("settings.mcp.tool.params") }}</h3>

        <CardList v-if="params.length">
          <CardRow v-for="param in params" :key="param.name" class="param-row">
            <div class="param-head">
              <span class="param-name">{{ param.name }}</span>

              <Badge v-if="param.required" size="s" variant="soft" color="info">
                {{ t("settings.mcp.tool.required") }}
              </Badge>

              <span class="param-type">{{ param.type }}</span>
            </div>

            <p v-if="param.description" class="param-desc">{{ param.description }}</p>

            <div
              v-if="param.defaultValue !== undefined || param.enumValues?.length"
              class="param-meta"
            >
              <span v-if="param.defaultValue !== undefined" class="param-default">
                {{ t("settings.mcp.tool.defaultValue", { value: param.defaultValue }) }}
              </span>

              <span v-if="param.enumValues?.length" class="param-enums">
                <code v-for="value in param.enumValues" :key="value" class="param-enum">
                  {{ value }}
                </code>
              </span>
            </div>
          </CardRow>
        </CardList>

        <p v-else class="section-empty">{{ t("settings.mcp.tool.noParams") }}</p>
      </section>

      <Collapsible v-if="inputJson || outputJson" v-model:open="schemaOpen" class="schema-fold">
        <CollapsibleTrigger>
          <template #render="{ props: part }">
            <button v-bind="part" type="button" class="fold-trigger">
              <ChevronRightIcon class="fold-chevron" :data-open="schemaOpen ? '' : undefined" />
              {{ t("settings.mcp.tool.schema") }}
            </button>
          </template>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div class="schema-body">
            <pre v-if="inputJson" class="schema-json">{{ inputJson }}</pre>

            <template v-if="outputJson">
              <h4 class="schema-sub">{{ t("settings.mcp.tool.outputSchema") }}</h4>
              <pre class="schema-json">{{ outputJson }}</pre>
            </template>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { McpExposure, McpToolView } from "@pig/protocol"

import { ChevronRightIcon } from "@components/icons/index.js"
import { extractToolParams } from "@features/settings/lib/mcp-tool-schema.js"
import { useI18n } from "@i18n/index.js"
import { Badge } from "@pig/ui/badge"
import { CardList, CardRow } from "@pig/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@pig/ui/dialog"

const ANNOTATION_META = [
  { key: "readOnlyHint", color: "info", label: "settings.mcp.tool.annotations.readOnly" },
  { key: "destructiveHint", color: "danger", label: "settings.mcp.tool.annotations.destructive" },
  { key: "idempotentHint", color: "neutral", label: "settings.mcp.tool.annotations.idempotent" },
  { key: "openWorldHint", color: "warning", label: "settings.mcp.tool.annotations.openWorld" },
] as const
const props = defineProps<{ tool: McpToolView | undefined; exposure: McpExposure }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const schemaOpen = ref(false)
const open = computed({
  get: () => Boolean(props.tool),
  set: (next: boolean) => {
    if (!next) emit("close")
  },
})
const params = computed(() => extractToolParams(props.tool?.inputSchema))
const hints = computed(() => {
  const annotations = props.tool?.annotations

  if (!annotations) return []
  return ANNOTATION_META.filter((item) => annotations[item.key] === true)
})
const inputJson = computed(() =>
  props.tool?.inputSchema ? JSON.stringify(props.tool.inputSchema, null, 2) : "",
)
const outputJson = computed(() =>
  props.tool?.outputSchema ? JSON.stringify(props.tool.outputSchema, null, 2) : "",
)

watch(
  () => props.tool?.name,
  () => {
    schemaOpen.value = false
  },
)
</script>

<style scoped>
.tool-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.tool-dialog-head,
.tool-section,
.schema-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.tool-dialog-title {
  padding-inline-end: var(--control-md);
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.tool-dialog-subtitle {
  margin: 0;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.tool-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
}

.tool-dialog-desc {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.tool-dialog-empty,
.section-empty {
  margin: 0;
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.section-title {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
}

.param-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding-block: var(--space-xs);
}

.param-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.param-name,
.param-type,
.param-enum,
.schema-json {
  font-family: var(--font-mono);
}

.param-name {
  color: var(--fg);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.param-type {
  margin-inline-start: auto;
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.param-desc {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: pre-wrap;
}

.param-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.param-enums {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
}

.param-enum {
  padding: 1px var(--space-2xs);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-min);
  background: var(--bg-surface);
  background-clip: padding-box;
  color: var(--fg-secondary);
}

.fold-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0;
  border: 0;
  background: none;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  cursor: pointer;
}

.fold-trigger:hover {
  color: var(--fg);
}

.fold-chevron {
  color: var(--fg-muted);
  transition: transform var(--duration-fast) var(--ease-out);
}

.fold-chevron[data-open] {
  transform: rotate(90deg);
}

.schema-body {
  padding-block-start: var(--space-xs);
}

.schema-sub {
  margin: var(--space-xs) 0 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.schema-json {
  margin: 0;
  padding: var(--space-sm);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  background-clip: padding-box;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: 1.5;
  overflow: auto;
  max-block-size: 18rem;
}
</style>
