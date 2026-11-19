<template>
  <CommandPalette v-model:open="open" :title="text(TITLE)">
    <CommandPaletteInput v-model="query" :placeholder="text(PLACEHOLDER)" />

    <CommandPaletteList>
      <CommandPaletteEmpty v-if="!matches.length">{{ text(EMPTY) }}</CommandPaletteEmpty>

      <template v-for="section in matches" :key="section.id">
        <CommandPaletteGroupLabel>{{ text(section.title) }}</CommandPaletteGroupLabel>

        <CommandPaletteItem
          v-for="item in section.items"
          :key="item.path"
          :value="item.path"
          @select="go(item.path)"
        >
          {{ text(item.title) }}
        </CommandPaletteItem>
      </template>
    </CommandPaletteList>
  </CommandPalette>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useRouter } from "vue-router"
import { useEventListener } from "@vueuse/core"
import { useGeneralPrefs } from "@features/settings/index.js"
import {
  CommandPalette,
  CommandPaletteEmpty,
  CommandPaletteGroupLabel,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
} from "@components/ui/command-palette/index.js"
import { NAV, type Label } from "@features/design-lab/lib/nav.js"

const TITLE: Label = { zh: "搜索页面", en: "Search pages" }
const PLACEHOLDER: Label = { zh: "页面、分组或路径", en: "Page, group or path" }
const EMPTY: Label = { zh: "没有匹配的页面", en: "No matching pages" }
const GUIDE: Label = { zh: "规范", en: "Spec" }
const GUIDE_ITEM = { path: "guide", title: { zh: "DESIGN.md 规范", en: "DESIGN.md spec" } }
// 分组顺序跟侧栏一致，DESIGN.md 自己一组
const SECTIONS = [
  ...NAV.map((group) => ({ id: group.id, title: group.title, items: group.items })),
  { id: "guide", title: GUIDE, items: [GUIDE_ITEM] },
]
const { locale } = useGeneralPrefs()
const router = useRouter()
const open = ref(false)
const query = ref("")
const matches = computed(() => {
  const term = query.value.trim().toLowerCase()

  if (!term) return SECTIONS
  return SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      [item.title.zh, item.title.en, item.path].some((value) => value.toLowerCase().includes(term)),
    ),
  })).filter((section) => section.items.length > 0)
})

function text(label: Label): string {
  return locale.value === "en" ? label.en : label.zh
}

function show() {
  open.value = true
}

function go(path: string) {
  open.value = false
  query.value = ""
  void router.push(`/design/${path}`)
}

// 输入框、正文里不抢 / 和 ⌘K
function onKeydown(event: KeyboardEvent) {
  const target = event.target

  if (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  ) {
    return
  }

  const mod = event.metaKey || event.ctrlKey

  if (!(event.key === "/" && !mod) && !(mod && event.key.toLowerCase() === "k")) return

  event.preventDefault()
  show()
}

useEventListener(window, "keydown", onKeydown)

defineExpose({ open: show })
</script>
