<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppSheet from "@/components/AppSheet.vue";
import { useMediaQuery } from "@/lib/utils/media";

/**
 * Owns the Workspace rail and Session sidebar containers. On wide viewports
 * both panels render inline in the shell grid; on narrow viewports they move
 * into keyboard-accessible modal sheets and the shell presents one primary
 * panel at a time. Sheets close automatically after navigation (a selection
 * inside the sheet changes the route).
 */
const narrow = useMediaQuery("(max-width: 900px)");
const openSheet = ref<"rail" | "sidebar" | null>(null);

const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    openSheet.value = null;
  },
);
</script>

<template>
  <template v-if="!narrow">
    <div class="nav-panel nav-panel-rail">
      <slot name="rail" />
    </div>
    <div class="nav-panel nav-panel-sidebar">
      <slot name="sidebar" />
    </div>
  </template>
  <template v-else>
    <div class="nav-toolbar" role="toolbar" aria-label="导航">
      <button type="button" class="btn" aria-haspopup="dialog" @click="openSheet = 'rail'">
        工作区
      </button>
      <button type="button" class="btn" aria-haspopup="dialog" @click="openSheet = 'sidebar'">
        会话
      </button>
    </div>
    <AppSheet :open="openSheet === 'rail'" title="工作区" @close="openSheet = null">
      <slot name="rail" />
    </AppSheet>
    <AppSheet :open="openSheet === 'sidebar'" title="会话" @close="openSheet = null">
      <slot name="sidebar" />
    </AppSheet>
  </template>
</template>

<style scoped>
.nav-panel {
  min-height: 0;
  overflow-y: auto;
  background: var(--color-surface);
}

.nav-panel-rail {
  border-right: 1px solid var(--color-border);
}

.nav-panel-sidebar {
  border-right: 1px solid var(--color-border);
}

.nav-toolbar {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
</style>
