<template>
  <article class="user">
    <div v-if="item.text || item.parts?.length" class="prompt">
      <div ref="body" class="body" :class="{ collapsed: !expanded, fade: !expanded && overflows }">
        <template v-for="(part, index) in parts" :key="index">
          <span v-if="part.kind === 'text'">{{ part.text }}</span>

          <TranscriptReplyCard
            v-else-if="part.kind === 'reference' && part.reference.kind === 'reply'"
            :reference="part.reference"
            :leading="index === 0"
            :trailing="index === parts.length - 1"
          />

          <TranscriptContextChip
            v-else-if="part.kind === 'reference'"
            :reference="part.reference"
          />

          <TranscriptLinkChip v-else :url="part.text" />
        </template>
      </div>

      <button
        v-if="overflows || expanded"
        type="button"
        class="toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? t("common.collapse") : t("common.expand") }}
      </button>
    </div>

    <div v-if="item.images.length" class="images">
      <TranscriptImage
        v-for="(image, index) in item.images"
        :key="index"
        :data="image.data"
        :mime-type="image.mimeType"
      />
    </div>

    <MessageTimestamp copy-before :timestamp="item.timestamp" :text="item.text" />
  </article>
</template>

<script setup lang="ts">
import { useResizeObserver } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from "vue"
import type { ContextReference } from "@pig/protocol"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import TranscriptContextChip from "@features/transcript-view/components/TranscriptContextChip.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import TranscriptLinkChip from "@features/transcript-view/components/TranscriptLinkChip.vue"
import TranscriptReplyCard from "@features/transcript-view/components/TranscriptReplyCard.vue"
import { splitLinkText, type LinkTextPart } from "@features/transcript-view/lib/link-chip.js"
import type { UserRow } from "@features/transcript-view/type.js"

type UserMessagePart = LinkTextPart | { kind: "reference"; reference: ContextReference }

const COLLAPSED_LINES = 12
const { t } = useI18n()
const props = defineProps<{
  item: UserRow
}>()
const body = useTemplateRef("body")
const expanded = ref(false)
const overflows = ref(likelyOverflows(props.item.text))
const isReplyRef = (part: UserMessagePart | undefined) =>
  part?.kind === "reference" && part.reference.kind === "reply"
const parts = computed(() => {
  const segments = props.item.parts ?? [{ kind: "text" as const, text: props.item.text }]
  const raw = segments.flatMap<UserMessagePart>((segment) =>
    segment.kind === "text" ? splitLinkText(segment.text) : [segment],
  )
  return raw.flatMap<UserMessagePart>((part, index) => {
    if (part.kind !== "text") return [part]
    let text = part.text

    if (isReplyRef(raw[index - 1])) text = text.replace(/^ /, "")

    if (isReplyRef(raw[index + 1])) text = text.replace(/ $/, "")
    return text ? [{ kind: "text", text }] : []
  })
})

function likelyOverflows(text: string): boolean {
  let newlines = 0

  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) {
    newlines += 1

    if (newlines >= COLLAPSED_LINES) return true
  }

  return text.length > 600
}

function measure(): void {
  const el = body.value

  if (!el || expanded.value) return
  overflows.value = el.scrollHeight - el.clientHeight > 1
}

watch(
  () => props.item.text,
  async () => {
    expanded.value = false
    overflows.value = likelyOverflows(props.item.text)
    await nextTick()
    measure()
  },
)

watch(expanded, async (open) => {
  if (open) return
  await nextTick()
  measure()
})

onMounted(measure)

useResizeObserver(body, measure)
</script>

<style scoped>
.user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
}

.prompt {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: fit-content;
  max-width: 85%;
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.body {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.body.collapsed {
  max-height: calc(var(--text-body--line-height) * 12em);
  overflow: hidden;
}

.body.fade {
  mask-image: linear-gradient(to bottom, black calc(100% - 3em), transparent);
}

.toggle {
  margin: var(--space-2xs) 0 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  line-height: 1.4;
  cursor: pointer;
}

.toggle:hover {
  color: var(--fg);
}

.images {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
  max-width: 100%;
}
</style>
