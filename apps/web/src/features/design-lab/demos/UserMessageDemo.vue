<template>
  <Story title="用户消息">
    <Variant title="短消息">
      <UserMessage :item="USER_SHORT" />
    </Variant>

    <Variant title="长消息（折叠）">
      <UserMessage :item="USER_LONG" />
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import { USER_LONG, USER_SHORT } from "@features/design-lab/lib/fixtures.js"
</script>
