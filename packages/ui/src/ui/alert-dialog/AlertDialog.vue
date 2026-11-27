<template>
  <AlertDialogRoot :persistent-elements="persistent" v-bind="$attrs">
    <slot />
  </AlertDialogRoot>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { AlertDialog as AlertDialogRoot } from "@ui-sdk/vue/alert-dialog"

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  persistentElements?: (Element | string)[] | (() => Element[])
}>()
const persistent = computed<(Element | string)[] | (() => Element[])>(() => {
  const extra = props.persistentElements

  if (typeof extra === "function")
    return () => [...extra(), ...Array.from(document.querySelectorAll("[data-persistent-overlay]"))]
  return [...(extra ?? []), "[data-persistent-overlay]"]
})
</script>
