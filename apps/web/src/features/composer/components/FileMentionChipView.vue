<template>
  <NodeViewWrapper as="span" class="chip-node" contenteditable="false" spellcheck="false">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="chip inline-chip"
          data-tone="info"
          :data-file-mention="path"
          @mousedown.prevent.stop
          @click.stop="onOpen"
        >
          <FolderIcon v-if="isDir" class="inline-chip-icon" aria-hidden="true" />
          <LanguageIcon v-else :language="language" class="chip-lang-icon" aria-hidden="true" />
          <span class="inline-chip-label">{{ label }}</span>
        </button>
      </TooltipTrigger>

      <TooltipContent side="top">{{ path }}</TooltipContent>
    </Tooltip>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3"
import { FolderIcon } from "@components/icons/index.js"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { composerChipActionsKey } from "@features/composer/lib/editor/chip-actions.js"
import {
  isDirectoryMentionPath,
  mentionLanguage,
} from "@features/composer/lib/editor/reply-citation.js"

const props = defineProps(nodeViewProps)
const actions = inject(composerChipActionsKey, undefined)
const path = computed(() => String(props.node.attrs["path"] ?? ""))
const label = computed(() => {
  const custom = String(props.node.attrs["label"] ?? "")
  return custom || path.value.split("/").filter(Boolean).pop() || path.value
})
const isDir = computed(() => isDirectoryMentionPath(path.value))
const language = computed(() => mentionLanguage(path.value))

function onOpen() {
  if (path.value) actions?.openFile(path.value)
}
</script>

<style scoped>
.chip-lang-icon {
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
}
</style>
