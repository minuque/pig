<template>
  <div v-if="show" class="modal-backdrop" @click.self="emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="authorize-title">
      <h2 id="authorize-title">授权 Workspace</h2>
      <p v-if="!previewPath">由本机 Gateway 打开 Windows 文件夹选择器。</p>
      <p v-if="previewPath" class="preview">
        <strong>将授权：</strong><span class="mono">{{ previewPath }}</span>
      </p>
      <div v-if="authorizeError" class="notice error" role="alert">{{ authorizeError }}</div>
      <div class="actions">
        <button type="button" class="secondary" :disabled="authorizing" @click="emit('close')">
          取消
        </button>
        <button
          v-if="!previewPath"
          ref="pickerButton"
          type="button"
          :disabled="authorizing"
          @click="emit('preview')"
        >
          {{ authorizing ? "选择中…" : "选择文件夹" }}
        </button>
        <template v-else>
          <button type="button" class="secondary" :disabled="authorizing" @click="emit('clear')">
            重新选择
          </button>
          <button type="button" :disabled="authorizing" @click="emit('confirm')">
            {{ authorizing ? "授权中…" : "确认并授权" }}
          </button>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

const props = defineProps<{
  show: boolean;
  previewPath: string;
  authorizing: boolean;
  authorizeError: string;
}>();

const emit = defineEmits<{
  close: [];
  preview: [];
  clear: [];
  confirm: [];
}>();

const pickerButton = ref<HTMLButtonElement>();
watch(
  () => props.show,
  async (show) => {
    if (show) {
      await nextTick();
      pickerButton.value?.focus();
    }
  },
);
</script>
