<template>
  <div
    class="startup-gate"
    :class="{
      'startup-underlay': concealed,
      'startup-underlay-transition': visible,
    }"
    :inert="visible || undefined"
    :aria-hidden="visible ? 'true' : undefined"
  >
    <slot />
  </div>
  <StartupOverlay
    v-if="visible && !failed"
    :ready="ready"
    :phase="phase"
    @reveal="reveal"
    @finished="finish"
  />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import StartupOverlay from "@features/startup/components/StartupOverlay.vue";
import { useStartupSequence } from "@features/startup/hooks/use-startup-sequence.js";

const props = defineProps<{
  connect: () => Promise<unknown>;
  initialize: () => Promise<unknown>;
}>();

const { visible, concealed, ready, failed, phase, reveal, finish, start } =
  useStartupSequence(props);

onMounted(() => {
  void start();
});
</script>

<style scoped>
.startup-gate {
  height: 100%;
}
.startup-gate.startup-underlay {
  opacity: 0;
}
.startup-gate.startup-underlay-transition {
  transition: opacity 360ms var(--ease-out) 60ms;
}
@media (prefers-reduced-motion: reduce) {
  .startup-gate.startup-underlay-transition {
    transition: none;
  }
}
</style>
