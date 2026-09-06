<template>
  <Blobatar
    ref="blob"
    class="hero-mascot"
    name="alain00"
    animate="always"
    :size="128"
    :style="{ '--mo-head': 'var(--primary)' }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue"
import { Blobatar } from "@blobatar/vue"
import { useGaze } from "@blobatar/vue/gaze"
import "blobatar/motion.css"
import "blobatar/gaze.css"

useGaze(useTemplateRef("blob"), { travel: 16, target: "pointer" })
</script>
