<template>
  <Card size="s" variant="surface" class="code-card"><slot /></Card>
</template>

<script setup lang="ts">
import { Card } from "@components/ui/card/index.js"
</script>

<style scoped>
/* 外观来自 Card；代码类卡片只把内边距交给内容 */
.code-card {
  --card-padding: 0;

  min-width: 0;
  color: var(--foreground);
}
</style>
