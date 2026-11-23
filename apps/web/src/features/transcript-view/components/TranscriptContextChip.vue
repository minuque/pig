<template>
  <RouterLink
    v-if="reference.kind === 'session'"
    class="chip inline-chip"
    :to="{ name: 'session', params: { sessionId: reference.sessionId } }"
    data-context-kind="session"
    :data-session-id="reference.sessionId"
    :title="reference.label"
  >
    {{ reference.label }}
  </RouterLink>

  <HoverCard v-else>
    <HoverCardTrigger as-child>
      <span class="chip inline-chip" data-context-kind="reply" tabindex="0">
        {{ `“${reference.label}”` }}
      </span>
    </HoverCardTrigger>

    <HoverCardContent side="top" align="start" size="s" max-width="420px">
      <div class="reply-quote">{{ reference.text }}</div>
    </HoverCardContent>
  </HoverCard>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router"
import type { ContextReference } from "@pig/protocol"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@components/ui/hover-card/index.js"

defineProps<{
  reference: ContextReference
}>()
</script>

<style scoped>
.reply-quote {
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
