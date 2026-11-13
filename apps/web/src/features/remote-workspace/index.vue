<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="remote-dialog">
      <DialogTitle>{{ t("remote.title") }}</DialogTitle>
      <DialogDescription>{{ t("remote.description") }}</DialogDescription>
      <p v-if="loaded && !hosts.length" class="remote-hint">{{ t("remote.noHosts") }}</p>

      <form v-else class="remote-form" @submit.prevent="submit">
        <label class="remote-field">
          <span>{{ t("remote.host") }}</span>

          <Select v-model="host">
            <SelectTrigger :aria-label="t('remote.host')" />

            <SelectContent>
              <SelectItem v-for="item in hosts" :key="item.id" :value="item.id">
                {{ item.host }}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label class="remote-field">
          <span>{{ t("remote.path") }}</span>
          <TextFieldRoot v-model="path" placeholder="/home/me/project" autofocus />
        </label>

        <p v-if="failed" class="remote-error" role="alert">{{ t("remote.notFound") }}</p>

        <div class="remote-actions">
          <DialogClose as-child>
            <Button variant="soft" color="gray" type="button">{{ t("common.cancel") }}</Button>
          </DialogClose>

          <Button type="submit" :loading="busy" :disabled="!host || !path.trim()">
            {{ t("remote.add") }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { listEnvironments } from "@client/platform.js"
import type { EnvironmentInfo } from "@/types/common-type.js"
import { Button } from "@components/ui/button/index.js"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@components/ui/dialog/index.js"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@components/ui/select/index.js"
import { TextFieldRoot } from "@components/ui/text-field/index.js"

const props = defineProps<{
  open: boolean
  /** 校验并登记远程目录；返回 false 表示目录不存在或主机连不上。 */
  add: (environment: string, path: string) => Promise<boolean>
}>()
const emit = defineEmits<{ "update:open": [open: boolean] }>()
const { t } = useI18n()
const environments = shallowRef<EnvironmentInfo[]>([])
const loaded = ref(false)
const host = ref("")
const path = ref("")
const busy = ref(false)
const failed = ref(false)
const hosts = computed(() => environments.value.filter((item) => item.kind === "ssh"))

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    failed.value = false
    environments.value = await listEnvironments().catch(() => [])
    loaded.value = true
    host.value ||= hosts.value[0]?.id ?? ""
  },
  { immediate: true },
)

// 换主机时带出它保存的默认目录
watch(host, (id) => {
  const saved = hosts.value.find((item) => item.id === id)?.defaultPath

  if (saved) path.value = saved
})

async function submit() {
  if (busy.value) return
  busy.value = true
  failed.value = false

  try {
    const ok = await props.add(host.value, path.value.trim())

    if (ok) emit("update:open", false)
    else failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<style>
/* 内容经 Portal 挂到 body，scoped 打不中，选择器统一挂在 .remote-dialog 前缀下。 */
.remote-dialog.rt-DialogContent {
  max-inline-size: var(--size-dialog-s);
}

.remote-dialog .remote-form {
  display: grid;
  gap: var(--space-sm);
  margin-block-start: var(--space-md);
}

.remote-dialog .remote-field {
  display: grid;
  gap: var(--space-xxs);
  font-size: var(--text-meta);
  color: var(--contrast-foreground-secondary);
}

.remote-dialog .remote-hint,
.remote-dialog .remote-error {
  margin: var(--space-sm) 0 0;
  font-size: var(--text-meta);
  color: var(--contrast-foreground-secondary);
}

.remote-dialog .remote-error {
  color: var(--danger);
}

.remote-dialog .remote-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
}
</style>
