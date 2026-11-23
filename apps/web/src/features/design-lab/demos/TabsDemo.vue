<template>
  <Story title="Tabs">
    <Variant v-for="size in SIZES" :key="size" :title="`Size ${size}`">
      <TabsRoot default-value="account">
        <TabsList :size="size">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="account" style="padding-top: 12px">Account content</TabsContent>
        <TabsContent value="documents" style="padding-top: 12px">Documents content</TabsContent>
        <TabsContent value="settings" style="padding-top: 12px">Settings content</TabsContent>
      </TabsRoot>
    </Variant>

    <Variant v-for="size in SIZES" :key="`segmented-${size}`" :title="`Segmented ${size}`">
      <TabsRoot default-value="day">
        <TabsList variant="segmented" :size="size">
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="year" disabled>Year</TabsTrigger>
        </TabsList>
      </TabsRoot>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@pig/ui/tabs"

const SIZES = ["s", "m"] as const
</script>
