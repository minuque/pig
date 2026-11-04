<template>
  <Story title="Separator">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 16px; max-width: 320px">
        <Separator size="1" />
        <Separator size="2" />
        <Separator size="3" />
        <Separator size="4" />
      </div>
    </Variant>

    <Variant title="Vertical">
      <div style="display: flex; align-items: center; gap: 12px; block-size: 40px">
        <span>Left</span>
        <Separator orientation="vertical" />
        <span>Middle</span>
        <Separator orientation="vertical" />
        <span>Right</span>
      </div>
    </Variant>

    <Variant title="Colors">
      <div style="display: flex; flex-direction: column; gap: 16px; max-width: 320px">
        <Separator color="gray" />
        <Separator color="indigo" />
        <Separator color="red" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { Separator } from "./index.js"
</script>
