<template>
  <section class="startup-error" aria-labelledby="startup-error-title" role="alert">
    <div class="error-cluster">
      <CircleAlert :size="32" class="error-icon" aria-hidden="true" />
      <h1 id="startup-error-title" class="error-title">无法启动工作台</h1>
      <p class="error-detail">{{ detail }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CircleAlert } from "lucide-vue-next";
import { useStartupError } from "@features/startup/hooks/use-startup-error.js";

const message = useStartupError();
const detail = computed(() => message.value.trim() || "启动过程中出现错误。");
</script>

<style scoped>
.startup-error {
  min-height: 0;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 0 var(--spacing-md);
}
.error-cluster {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  max-width: min(var(--size-composer), 100%);
  text-align: center;
}
.error-icon {
  flex: none;
  color: var(--ink-faint);
}
.error-title {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
}
.error-detail {
  margin: 0;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  overflow-wrap: anywhere;
}
</style>
