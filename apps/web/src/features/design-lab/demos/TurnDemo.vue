<template>
  <Story title="对话一轮">
    <Variant title="用户提问、工具组、助手回答">
      <TurnRow
        :turn="TURN"
        session-id="design-lab"
        :running="false"
        :is-expand="(id) => expanded.get(id)"
        :expanded-tools="tools"
        @toggle-expand="(id, open) => expanded.set(id, open)"
        @toggle-tool="(_, id, open) => tools.set(id, open)"
      />
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { reactive } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import TurnRow from "@features/transcript-view/components/TurnRow.vue"
import { TURN } from "@features/design-lab/lib/fixtures.js"

const expanded = reactive(new Map<string, boolean>())
const tools = reactive(new Map<string, boolean>())
</script>
