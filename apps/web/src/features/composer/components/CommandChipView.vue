<template>
  <NodeViewWrapper as="span" class="chip-node" contenteditable="false" spellcheck="false">
    <Tooltip>
      <TooltipTrigger>
        <template #render="{ props: part }">
          <span
            v-bind="part"
            class="chip inline-chip"
            data-tone="accent"
            :data-command-chip="name"
            :data-command-kind="isSkill ? 'skill' : undefined"
          >
            <ZapIcon v-if="isSkill" class="inline-chip-icon" aria-hidden="true" />
            <SquareCodeIcon v-else class="inline-chip-icon" aria-hidden="true" />
            <span class="inline-chip-label">{{ label }}</span>
          </span>
        </template>
      </TooltipTrigger>

      <TooltipContent side="top">/{{ label }}</TooltipContent>
    </Tooltip>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3"
import { SquareCodeIcon, ZapIcon } from "@components/icons/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"

const props = defineProps(nodeViewProps)
const name = computed(() => String(props.node.attrs["name"] ?? ""))
const isSkill = computed(() => props.node.attrs["kind"] === "skill")
const label = computed(() => (isSkill.value ? `skill:${name.value}` : name.value))
</script>
