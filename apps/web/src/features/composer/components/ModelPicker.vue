<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <Tooltip :disabled="!labelsOverflow && !locked">
      <TooltipTrigger as-child>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            color="neutral"
            size="m"
            class="selector"
            :disabled="disabled"
            :aria-label="t('composer.selectModel', { model: triggerText })"
            @pointerenter="measureLabels"
          >
            <VendorMark
              v-if="current.vendor"
              :vendor="current.vendor.id"
              :name="current.vendor.name"
              :size="16"
            />

            <span ref="labelsRef" class="selector-labels">
              <span class="selector-name">{{ label }}</span>
              <RollText v-if="effortLabel" class="selector-effort" :text="effortLabel" />
            </span>
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>

      <TooltipContent>
        {{ locked ? t("composer.modelLockedWhileRunning") : triggerText }}
      </TooltipContent>
    </Tooltip>

    <ModelPickerPanel
      v-model:open="open"
      :catalog="catalog"
      :model="model"
      :level="level"
      :locked="locked"
      @pick="emit('update:model', $event)"
      @update:level="emit('update:level', $event)"
    />
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { Button } from "@components/ui/button/index.js"
import { DropdownMenu, DropdownMenuTrigger } from "@components/ui/dropdown-menu/index.js"
import { RollText } from "@components/ui/roll-text/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import VendorMark from "@components/icons/VendorMark.vue"
import ModelPickerPanel from "@features/composer/components/ModelPickerPanel.vue"
import { resolveModelInfo } from "@features/composer/lib/model-preset.js"
import {
  displayThinkingLevel,
  formatThinkingLevel,
  pickerTriggerText,
} from "@features/composer/lib/thinking-level.js"
import type { ComposerModel, ComposerVendor } from "@features/composer/type.js"

const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[]
    model: ComposerModel | undefined
    level?: string
    disabled?: boolean
    locked?: boolean
  }>(),
  { level: "", disabled: false, locked: false },
)
const emit = defineEmits<{
  "update:model": [value: ComposerModel]
  "update:level": [value: string]
}>()
const open = defineModel<boolean>("open", { default: false })
const labelsRef = useTemplateRef<HTMLElement>("labelsRef")
const labelsOverflow = shallowRef(false)
const { t } = useI18n()
const current = computed(() => resolveModelInfo(props.catalog, props.model))
const label = computed(() => current.value.model?.name ?? props.model?.id ?? "—")
const effortLabel = computed(() =>
  formatThinkingLevel(displayThinkingLevel(props.level, current.value.levels)),
)
const triggerText = computed(() =>
  pickerTriggerText(label.value, props.level, current.value.levels),
)

function measureLabels() {
  const el = labelsRef.value

  labelsOverflow.value = el ? el.scrollWidth > el.clientWidth + 1 : false
}
</script>

<style scoped>
.selector[data-button] {
  min-width: 0;
  flex-shrink: 1;
  margin: 0;
  gap: var(--space-xs);
  color: var(--fg);
  font-size: var(--text-body);
}

.selector[data-button]:not(:disabled):hover {
  background-color: var(--bg-hover);
}

.selector[data-button][data-state="open"] {
  background-color: var(--bg-selected);
}

.selector-labels {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
}

.selector-name {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-effort {
  flex: none;
  color: var(--fg-secondary);
}
</style>
