<template>
  <SessionForkMark
    v-if="foot.parent"
    :parent="foot.parent"
    @open="emit('open', $event)"
    @hover="emit('forkHover', $event)"
  />

  <VendorMark
    v-if="foot.model"
    class="row-vendor"
    :vendor="foot.model.provider"
    :name="foot.model.id"
    :size="14"
  />
</template>

<script setup lang="ts">
import VendorMark from "@components/icons/VendorMark.vue"
import SessionForkMark from "@features/session-nav/components/SessionForkMark.vue"
import type { SidebarRowFoot } from "@features/session-nav/type.js"

defineProps<{ foot: SidebarRowFoot }>()

const emit = defineEmits<{ open: [id: string]; forkHover: [hovering: boolean] }>()
</script>

<style scoped>
.row-vendor {
  flex: none;
  opacity: 0.6;
}
</style>
