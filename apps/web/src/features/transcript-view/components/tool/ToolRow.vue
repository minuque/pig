<template>
  <div class="tool-row" :class="{ 'is-failed': call.isError, 'is-running': call.running }">
    <button
      type="button"
      class="tool-row-trigger"
      :class="{ 'is-file': Boolean(target.path) }"
      :aria-expanded="open"
      @click="emit('toggle', !open)"
    >
      <RollText class="tool-row-text" :text="lineText">
        <span class="tool-row-line">
          <span
            class="tool-row-verb"
            :class="{ shimmer: Boolean(liveVerb) }"
            :data-text="liveVerb ?? undefined"
          >
            {{ shownVerb }}
          </span>

          <span v-if="target.text" class="tool-row-target" :title="target.path || target.text">
            {{ target.text }}
          </span>
        </span>
      </RollText>

      <span v-if="lineChange.added || lineChange.removed" class="tool-row-counts">
        <span v-if="lineChange.added" class="added">+{{ lineChange.added }}</span>
        <span v-if="lineChange.removed" class="removed">-{{ lineChange.removed }}</span>
      </span>

      <AltArrowRightIcon class="tool-row-caret" :class="{ 'is-open': open }" data-icon="inline" />

      <span v-if="thumb" class="tool-row-thumb" aria-hidden="true">
        <img :src="thumb" alt="" />
      </span>
    </button>

    <div v-if="open" class="tool-row-body">
      <ToolCommandBody v-if="variant === 'command'" :call="call" />

      <ToolFileBody
        v-else-if="variant === 'read' || variant === 'edit' || variant === 'search'"
        :call="call"
      />

      <ToolGenericBody v-else :call="call" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { AltArrowRightIcon } from "@components/icons/index.js"
import RollText from "@features/transcript-view/components/RollText.vue"
import ToolCommandBody from "@features/transcript-view/components/tool/ToolCommandBody.vue"
import ToolFileBody from "@features/transcript-view/components/tool/ToolFileBody.vue"
import ToolGenericBody from "@features/transcript-view/components/tool/ToolGenericBody.vue"
import {
  toolCallLiveVerb,
  toolCallTarget,
  toolCallVariant,
  toolCallVerb,
} from "@features/transcript-view/lib/tool-run.js"
import { itemLineChange } from "@features/transcript-view/lib/tool-summary.js"
import { transcriptImageSrc } from "@features/transcript-view/lib/transcript-format.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{
  call: ToolCallView
  open: boolean
}>()
const emit = defineEmits<{ toggle: [open: boolean] }>()
const variant = computed(() => toolCallVariant(props.call))
const verb = computed(() => toolCallVerb(props.call))
const liveVerb = computed(() => (props.call.running ? toolCallLiveVerb(props.call) : null))
const shownVerb = computed(() => liveVerb.value ?? verb.value)
const target = computed(() => toolCallTarget(props.call))
const lineText = computed(() => [shownVerb.value, target.value.text].filter(Boolean).join(" "))
const lineChange = computed(() => itemLineChange(props.call.toolName, props.call.input))
const thumb = computed(() => {
  const image = props.call.outputImages[0]
  return image ? transcriptImageSrc(image.data, image.mimeType) : null
})
</script>

<style scoped>
.tool-row {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tool-row-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-muted);
  font: inherit;
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-align: start;
  cursor: pointer;
}

.tool-row-trigger:hover,
.tool-row-trigger:focus-visible,
.tool-row-trigger[aria-expanded="true"] {
  color: var(--contrast-foreground-secondary);
}

.tool-row-text {
  flex: 0 1 auto;
  min-width: 0;
}

.tool-row-line {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  min-width: 0;
}

.tool-row-target {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-row-trigger.is-file .tool-row-target {
  color: var(--contrast-foreground);
  font-weight: var(--font-weight-medium);
}

.tool-row-caret {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  transition: transform var(--duration-fast) var(--ease-out);
}

.tool-row-thumb {
  flex: none;
  width: 44px;
  height: 32px;
  margin-inline-start: auto;
  overflow: clip;
  border-radius: var(--radius-xs);
  background: var(--background-soft);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.tool-row-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tool-row-verb {
  flex: none;
  white-space: nowrap;
}

.tool-row-caret.is-open {
  transform: rotate(90deg);
}

.tool-row-counts {
  display: flex;
  flex: none;
  gap: var(--space-xxs);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.tool-row-counts .added {
  padding: 0 var(--space-xxs);
  border-radius: var(--radius-xs);
  background: var(--success-bg);
  color: var(--success);
}

.tool-row-counts .removed {
  padding: 0 var(--space-xxs);
  border-radius: var(--radius-xs);
  background: var(--danger-bg);
  color: var(--danger);
}

.added {
  color: var(--success);
}

.removed {
  color: var(--danger);
}

.is-failed .tool-row-verb {
  color: var(--danger);
}

.tool-row-body {
  min-width: 0;
  padding-block-start: var(--space-xs);
  font-size: var(--text-meta);
  line-height: var(--text-code-line);
}

@media (prefers-reduced-motion: reduce) {
  .tool-row-caret {
    transition: none;
  }
}
</style>
