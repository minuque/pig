<template>
  <section class="startup-error" aria-labelledby="startup-error-title" role="alert">
    <h1 id="startup-error-title" class="error-title">无法启动工作台</h1>
    <p class="error-detail">{{ detail }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStartupError } from "@features/startup-wait/hooks/use-startup-error.js";

const message = useStartupError();
const detail = computed(() => message.value.trim() || "启动过程中出现错误。");
</script>

<style scoped>
.startup-error {
  min-height: 0;
  flex: 1;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-md);
}
.error-title {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-heading-2);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-heading-2--line-height);
  letter-spacing: var(--tracking-heading-2);
  text-align: center;
}
.error-detail {
  margin: 0;
  max-width: min(var(--size-composer), 100%);
  color: var(--ink-faint);
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
  text-align: center;
  overflow-wrap: anywhere;
}
</style>
