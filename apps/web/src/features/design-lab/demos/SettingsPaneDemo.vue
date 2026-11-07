<template>
  <Story title="设置分区">
    <Variant title="通用（真实设置，改动会写入本机偏好）">
      <GeneralPane />
    </Variant>

    <Variant title="通知">
      <NotificationsPane />
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import GeneralPane from "@features/settings/components/GeneralPane.vue"
import NotificationsPane from "@features/settings/components/NotificationsPane.vue"
</script>
