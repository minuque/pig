<template>
  <section class="ask-record" :aria-label="title">
    <header class="title">
      <MessageCircleQuestionIcon class="title-icon" aria-hidden="true" />
      {{ title }}
    </header>

    <dl class="lines">
      <div v-for="(line, index) in row.lines" :key="index" class="line">
        <dt class="question">{{ line.question }}</dt>
        <dd class="answer">
          <span class="chosen">{{ line.chosen }}</span>
          <span v-if="line.others.length" class="others">{{ line.others.join(" · ") }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { MessageCircleQuestionIcon } from "@components/icons/index.js"
import { useI18n } from "@i18n/index.js"
import type { AskRecordRow } from "@features/transcript-view/type.js"

const props = defineProps<{ row: AskRecordRow }>()
const { t } = useI18n()
const title = computed(() => t("transcript.askAnswered", { count: props.row.lines.length }))
</script>

<style scoped>
.ask-record {
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background-clip: padding-box;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.title-icon {
  width: var(--icon-md);
  height: var(--icon-md);
  color: var(--fg-muted);
}

.lines {
  margin: 0;
}

.line {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: var(--space-md);
  padding: var(--space-xs) var(--space-sm);
  box-shadow: var(--separator-top);
}

.question {
  color: var(--fg-muted);
}

.answer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-width: 0;
  margin: 0;
}

.chosen {
  color: var(--fg);
  font-weight: var(--font-weight-medium);
}

.others {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}
</style>
