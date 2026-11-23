<template>
  <Story title="Toast">
    <Variant title="Levels">
      <div class="demo-row">
        <Button
          variant="secondary"
          color="neutral"
          @click="notify('会话在别处有更新，已刷新', 'info')"
        >
          Info
        </Button>

        <Button
          variant="secondary"
          color="neutral"
          @click="notify('这一轮已完成', 'success', { title: 'Issue Tiers and Completion Status' })"
        >
          Success
        </Button>

        <Button
          variant="secondary"
          color="neutral"
          @click="notify('这一轮出错了', 'warning', { title: 'pi-cc-extensions' })"
        >
          Warning
        </Button>

        <Button variant="secondary" color="neutral" @click="notify('没能停止这个任务，请再试一次')">
          Error
        </Button>
      </div>
    </Variant>

    <Variant title="With action">
      <div class="demo-row">
        <Button
          variant="secondary"
          color="neutral"
          @click="
            notify('这一轮已完成', 'success', {
              title: 'Issue Tiers and Completion Status',
              action: { label: '打开', run: () => notify('已打开会话', 'info') },
            })
          "
        >
          Background turn finished
        </Button>
      </div>
    </Variant>

    <Variant title="Long error">
      <div class="demo-row">
        <Button variant="secondary" color="neutral" @click="notify(LONG_ERROR)">Persistent</Button>

        <Button
          variant="secondary"
          color="neutral"
          @click="notify(LONG_ERROR, 'error', { transient: true })"
        >
          Transient
        </Button>
      </div>
    </Variant>

    <Toaster />
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Toaster, notify } from "@components/ui/toast/index.js"
import { Button } from "@components/ui/button/index.js"

const LONG_ERROR =
  '402: {"message":"Insufficient Balance (request_id: 28067d88-18aa-4bbd-83e5-899e93121d0e)","type":"insufficient_balance_error","param":null,"code":"invalid_request_error"} — the provider rejected this turn before any output was produced.'
</script>

<style scoped>
.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}
</style>
