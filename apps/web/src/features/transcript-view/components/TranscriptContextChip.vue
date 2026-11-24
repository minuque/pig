<template>
  <Tooltip v-if="reference.kind === 'session'">
    <TooltipTrigger as-child>
      <RouterLink
        class="chip inline-chip"
        data-tone="success"
        :to="{ name: 'session', params: { sessionId: reference.sessionId } }"
        data-context-kind="session"
        :data-session-id="reference.sessionId"
      >
        <MessageSquareIcon class="inline-chip-icon" aria-hidden="true" />
        <span class="inline-chip-label">{{ reference.label }}</span>
      </RouterLink>
    </TooltipTrigger>

    <TooltipContent side="top">{{ reference.label }}</TooltipContent>
  </Tooltip>

  <TranscriptReplyCard v-else :reference="reference" />
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router"
import type { ContextReference } from "@pig/protocol"
import { MessageSquareIcon } from "@components/icons/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import TranscriptReplyCard from "@features/transcript-view/components/TranscriptReplyCard.vue"

defineProps<{
  reference: ContextReference
}>()
</script>
