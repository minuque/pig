<template>
  <!-- 图标包自带的静态 SVG -->
  <!-- eslint-disable vue/no-v-html -->
  <span
    class="language-icon"
    role="img"
    :aria-label="language"
    :style="{ color: `var(--language-${icon.hue})` }"
    v-html="icon.svg"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>

<script setup lang="ts">
import { computed } from "vue"
import astro from "@pierre/vscode-icons/svgs/astro.svg?raw"
import bash from "@pierre/vscode-icons/svgs/bash.svg?raw"
import braces from "@pierre/vscode-icons/svgs/braces.svg?raw"
import code from "@pierre/vscode-icons/svgs/code.svg?raw"
import docker from "@pierre/vscode-icons/svgs/docker.svg?raw"
import table from "@pierre/vscode-icons/svgs/file-table.svg?raw"
import text from "@pierre/vscode-icons/svgs/file-text.svg?raw"
import graphql from "@pierre/vscode-icons/svgs/graphql.svg?raw"
import c from "@pierre/vscode-icons/svgs/lang-c.svg?raw"
import css from "@pierre/vscode-icons/svgs/lang-css.svg?raw"
import go from "@pierre/vscode-icons/svgs/lang-go.svg?raw"
import html from "@pierre/vscode-icons/svgs/lang-html.svg?raw"
import javascript from "@pierre/vscode-icons/svgs/lang-javascript.svg?raw"
import markdown from "@pierre/vscode-icons/svgs/lang-markdown.svg?raw"
import python from "@pierre/vscode-icons/svgs/lang-python.svg?raw"
import ruby from "@pierre/vscode-icons/svgs/lang-ruby.svg?raw"
import rust from "@pierre/vscode-icons/svgs/lang-rust.svg?raw"
import swift from "@pierre/vscode-icons/svgs/lang-swift.svg?raw"
import typescript from "@pierre/vscode-icons/svgs/lang-typescript.svg?raw"
import database from "@pierre/vscode-icons/svgs/server.svg?raw"
import svelte from "@pierre/vscode-icons/svgs/svelte.svg?raw"
import terraform from "@pierre/vscode-icons/svgs/terraform.svg?raw"
import vue from "@pierre/vscode-icons/svgs/vue.svg?raw"
import yaml from "@pierre/vscode-icons/svgs/yml.svg?raw"
import zig from "@pierre/vscode-icons/svgs/zig.svg?raw"

const props = defineProps<{ language: string }>()

type Hue =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "pink"

const ALIASES: [icon: string, hue: Hue, names: string[]][] = [
  [astro, "purple", ["astro"]],
  [
    bash,
    "green",
    ["bash", "sh", "shell", "shellscript", "zsh", "fish", "console", "powershell", "ps1"],
  ],
  [braces, "orange", ["json", "jsonc", "json5", "jsonl"]],
  [docker, "blue", ["docker", "dockerfile"]],
  [table, "teal", ["csv", "tsv"]],
  [text, "gray", ["text", "txt", "plaintext", "plain"]],
  [graphql, "pink", ["graphql", "gql"]],
  [c, "blue", ["c", "h", "cpp", "c++", "cc", "hpp", "csharp", "cs", "c#", "objc", "objective-c"]],
  [css, "indigo", ["css", "scss", "sass", "less", "postcss", "stylus"]],
  [go, "cyan", ["go", "golang"]],
  [html, "orange", ["html", "htm", "xhtml"]],
  [javascript, "yellow", ["javascript", "js", "jsx", "mjs", "cjs"]],
  [markdown, "gray", ["markdown", "md", "mdx"]],
  [python, "blue", ["python", "py"]],
  [ruby, "red", ["ruby", "rb"]],
  [rust, "orange", ["rust", "rs"]],
  [swift, "orange", ["swift"]],
  [typescript, "cyan", ["typescript", "ts", "tsx", "mts", "cts"]],
  [database, "purple", ["sql", "mysql", "postgresql", "postgres", "sqlite"]],
  [svelte, "red", ["svelte"]],
  [terraform, "indigo", ["terraform", "hcl", "tf"]],
  [vue, "green", ["vue"]],
  [yaml, "red", ["yaml", "yml"]],
  [zig, "orange", ["zig"]],
]
const ICONS = new Map(
  ALIASES.flatMap(([svg, hue, names]) => names.map((name) => [name, { svg, hue }] as const)),
)
const icon = computed(() => ICONS.get(props.language.toLowerCase()) ?? { svg: code, hue: "gray" })
</script>

<style scoped>
.language-icon {
  display: inline-flex;
  flex: none;
  width: var(--size-icon-2xs);
  height: var(--size-icon-2xs);
}

.language-icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
