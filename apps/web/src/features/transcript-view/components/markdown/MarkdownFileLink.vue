<template>
  <Link
    href="#"
    class="file-link"
    color="cyan"
    weight="medium"
    underline="hover"
    :title="path"
    @click.prevent="fileOpener?.open({ path })"
  >
    <LanguageIcon class="file-link-icon" :language="fileExtension(target)" aria-hidden="true" />
    {{ fileLinkLabel(path) }}
  </Link>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import { Link } from "@components/ui/link/index.js"
import { openFileKey } from "@features/transcript-view/index.js"
import {
  fileExtension,
  fileLinkLabel,
  filePosition,
} from "@features/transcript-view/lib/file-link.js"

const props = defineProps<{ path: string }>()
const fileOpener = inject(openFileKey, undefined)
const target = computed(() => filePosition(props.path).path)
</script>

<style scoped>
.file-link {
  display: inline-block;
  max-width: 100%;
  overflow-x: clip;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.file-link .file-link-icon {
  width: 1em;
  height: 1em;
  margin-inline-end: 0.2em;
  vertical-align: -0.125em;
}
</style>
