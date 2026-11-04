<template>
  <Story title="Kbd">
    <Variant title="Variants">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Kbd variant="classic">Classic</Kbd>
        <Kbd variant="soft">Soft</Kbd>
      </div>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Kbd size="s">Small</Kbd>
        <Kbd size="m">Medium</Kbd>
        <Kbd size="l">Large</Kbd>
      </div>
    </Variant>

    <Variant title="Combination">
      <div style="display: flex; align-items: center; gap: 4px">
        <Kbd>Ctrl</Kbd>
        <span>+</span>
        <Kbd>Shift</Kbd>
        <span>+</span>
        <Kbd>K</Kbd>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { Kbd } from "./index.js"
</script>
