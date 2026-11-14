<template>
  <div class="file-notice">
    <p class="file-notice-text">{{ text }}</p>

    <Button v-if="action" size="s" variant="soft" color="gray" @click="emit('action')">
      {{ action }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@components/ui/button/index.js"

/** 打不开的文件：一行说明，必要时给一个动作。 */
defineProps<{ text: string; action?: string | undefined }>()

const emit = defineEmits<{ action: [] }>()
</script>

<style scoped>
.file-notice {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
}

.file-notice-text {
  margin: 0;
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-body);
  text-align: center;
}
</style>
