<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Link
        href="#"
        class="file-link"
        color="cyan"
        weight="medium"
        underline="hover"
        @click.prevent="folder ? fileOpener?.reveal(path) : fileOpener?.open({ path })"
      >
        <FolderIcon v-if="folder" class="file-link-icon is-folder" />

        <LanguageIcon
          v-else
          class="file-link-icon"
          :language="fileExtension(target)"
          aria-hidden="true"
        />

        <span>{{ fileLinkLabel(path) }}</span>
      </Link>
    </TooltipTrigger>

    <TooltipContent>{{ path }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import { FolderIcon } from "@components/icons/index.js"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import { Link } from "@components/ui/link/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { openFileKey } from "@features/transcript-view/index.js"
import {
  fileExtension,
  fileLinkLabel,
  filePosition,
  looksLikeFolder,
} from "@features/transcript-view/lib/file-link.js"

const props = defineProps<{ path: string }>()
const fileOpener = inject(openFileKey, undefined)
const target = computed(() => filePosition(props.path).path)
const folder = computed(() => looksLikeFolder(props.path))
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
  display: inline-block;
  width: 1em;
  height: 1em;
  margin-inline-end: 0.2em;
  vertical-align: -0.125em;
}

.file-link .file-link-icon.is-folder {
  color: var(--fg-secondary);
}
</style>
