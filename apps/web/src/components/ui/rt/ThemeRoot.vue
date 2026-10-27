<template>
  <div
    class="radix-themes"
    :class="{ dark: isDark }"
    :data-accent-color="accent"
    :data-gray-color="gray"
    :data-is-root-theme="root ? 'true' : undefined"
    data-has-background="false"
    data-panel-background="translucent"
    data-radius="medium"
    data-scaling="100%"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { findAccent } from "@features/theme/lib/accents.js"
import { useColorScheme } from "@features/theme/index.js"

/**
 * Radix Themes 的作用域容器：rt 的面板、阴影、间距与圆角 token 都挂在 .radix-themes 上。
 * 弹层用 Teleport 飞出文档流，调用方要在 teleport 内容里再包一层，否则拿不到这些 token。
 * root 只给应用根用：rt 靠它把 color-scheme 与 min-height 挂到 html 上。
 */
const props = withDefaults(defineProps<{ root?: boolean }>(), { root: false })
const { isDark, accent } = useColorScheme()
const gray = computed(() => findAccent(accent.value).gray)
</script>
