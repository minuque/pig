<script setup lang="ts">
import { Toaster as Sonner } from "vue-sonner";
import "vue-sonner/style.css";
</script>

<template>
  <Sonner
    class="toaster group"
    :style="{
      '--normal-bg': 'var(--surface)',
      '--normal-text': 'var(--ink)',
      '--normal-border': 'var(--hairline)',
      '--border-radius': 'var(--radius-md)',
    }"
  />
</template>
