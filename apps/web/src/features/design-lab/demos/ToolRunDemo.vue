<template>
  <Story title="工具组">
    <Variant v-for="item in ROWS" :key="item.title" :title="item.title">
      <ToolRun
        :row="item.row"
        :expanded="expanded.get(item.row.id) ?? true"
        :expanded-tools="tools"
        @toggle-expand="(open) => expanded.set(item.row.id, open)"
        @toggle-tool="(id, open) => tools.set(id, open)"
      />
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { reactive } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import ToolRun from "@features/transcript-view/components/tool/ToolRun.vue"
import { toolRow } from "@features/design-lab/lib/fixtures.js"

const ROWS = [
  { title: "已完成：思考、读取、搜索、编辑、命令、失败的外部工具", row: toolRow("done") },
  { title: "运行中", row: toolRow("live") },
]
const expanded = reactive(new Map<string, boolean>())
const tools = reactive(new Map<string, boolean>())
</script>
