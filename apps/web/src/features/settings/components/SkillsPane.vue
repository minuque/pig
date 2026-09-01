<template>
  <section class="pane">
    <p v-if="!cwd" class="empty">先添加工作目录</p>
    <template v-else>
      <p class="cwd">{{ cwd }}</p>
      <p class="empty">当前工作目录没有技能</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useSettingsCwd } from "@features/settings/hooks/use-settings-cwd.js"

const cwd = useSettingsCwd()
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.cwd {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  word-break: break-all;
}
.empty {
  margin: 0;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
