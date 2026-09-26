<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...$attrs, ...forwarded, ...(reference && { reference }) }"
      class="menu-surface surface-float z-(--z-drawer) max-h-(--reka-dropdown-menu-content-available-height) origin-(--reka-dropdown-menu-content-transform-origin) text-ink opacity-0 transition-opacity duration-(--duration-fast) ease-(--ease-out) data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-fade_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none"
      :class="[bare ? undefined : 'min-w-(--size-context-menu)', props.class]"
    >
      <div v-if="!bare" class="menu-list max-h-(--reka-dropdown-menu-content-available-height)">
        <slot />
      </div>

      <slot v-else />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import type { DropdownMenuContentEmits, DropdownMenuContentProps } from "reka-ui"
import { computed, type ComputedRef, type HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from "reka-ui"
import { usePopperAnchor } from "@components/ui/popper-anchor.js"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    DropdownMenuContentProps & {
      class?: HTMLAttributes["class"]
      /** 大面板自管内边距，不套菜单列表壳。 */
      bare?: boolean
    }
  >(),
  {
    class: undefined,
    sideOffset: 4,
    collisionPadding: 8,
    bare: false,
  },
)
const emits = defineEmits<DropdownMenuContentEmits>()
// 被 Tooltip 包住时 MenuAnchor 会注册到 Tooltip 的 PopperRoot，须显式传触发元素当锚点
const anchor = usePopperAnchor()
const reference = computed(() => props.reference ?? anchor?.value)
const delegatedProps = reactiveOmit(props, "class", "bare")
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<DropdownMenuContentProps>
</script>

<style src="../menu-surface.css"></style>
