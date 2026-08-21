<script setup lang="ts">
import { Toaster as Sonner } from "vue-sonner";
import "vue-sonner/style.css";
</script>

<template>
  <Sonner
    class="toaster group"
    :style="{
      '--normal-bg': 'var(--surface)',
      '--normal-bg-hover': 'var(--canvas-soft)',
      '--normal-text': 'var(--ink)',
      '--normal-border': 'var(--hairline)',
      '--border-radius': 'var(--radius-md)',
      '--gray2': 'var(--canvas-soft)',
      '--gray4': 'var(--hairline)',
      '--gray5': 'var(--hairline)',
      '--gray12': 'var(--ink)',
    }"
  />
</template>
