<template>
  <Story title="Card">
    <Variant title="Variants">
      <div style="display: flex; flex-wrap: wrap; gap: 12px">
        <Card variant="surface" style="width: 200px">
          <div style="padding: 16px">Surface</div>
        </Card>

        <Card variant="classic" style="width: 200px">
          <div style="padding: 16px">Classic</div>
        </Card>

        <Card variant="ghost" style="width: 200px">
          <div style="padding: 16px">Ghost</div>
        </Card>
      </div>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px">
        <Card size="s" style="width: 200px">
          <div style="padding: 16px">Small</div>
        </Card>

        <Card size="m" style="width: 200px">
          <div style="padding: 16px">Medium</div>
        </Card>

        <Card size="l" style="width: 200px">
          <div style="padding: 16px">Large</div>
        </Card>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { Card } from "./index.js"
</script>
