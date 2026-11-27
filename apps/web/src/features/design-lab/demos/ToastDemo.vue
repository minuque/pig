<template>
  <Story title="Toast">
    <Variant title="Status">
      <div class="demo-row">
        <Button variant="secondary" color="neutral" @click="showInfo">Info</Button>
        <Button variant="secondary" color="neutral" @click="showSuccess">Success</Button>
        <Button variant="secondary" color="neutral" @click="showWarning">Warning</Button>
        <Button variant="secondary" color="neutral" @click="showError">Error</Button>
      </div>
    </Variant>

    <Variant title="Action">
      <div class="demo-row">
        <Button variant="secondary" color="neutral" @click="showUndo">Queue Undo</Button>
        <Button variant="secondary" color="neutral" @click="showRetry">Error Retry</Button>
      </div>
    </Variant>

    <Variant title="Progress">
      <div class="demo-row">
        <Button variant="secondary" color="neutral" @click="runProgress(true)">
          Progress → Succeed
        </Button>

        <Button variant="secondary" color="neutral" @click="runProgress(false)">
          Progress → Fail
        </Button>
      </div>
    </Variant>

    <Toaster />
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Toaster, toastAction, toastProgress, toastStatus } from "@pig/ui/toast"
import { Button } from "@pig/ui/button"

function showInfo() {
  toastStatus("会话在别处已更新，消息未发送，已刷新", { tone: "info" })
}

function showSuccess() {
  toastStatus("已重新加载扩展、技能与模板", { tone: "success" })
}

function showWarning() {
  toastStatus("停止请求超时，仍在等待中断", { tone: "warning" })
}

function showError() {
  toastStatus("没能加载历史消息，请重试", { tone: "error" })
}

function showUndo() {
  toastAction("已从队列移除", {
    label: "撤销",
    icon: "undo",
    revertedLabel: "已放回队列",
    run: () => undefined,
  })
}

function showRetry() {
  toastAction(
    "归档没能完成",
    {
      label: "重试",
      icon: "retry",
      run: () => {
        toastStatus("已归档「设计评审」", { tone: "success" })
      },
    },
    { tone: "error" },
  )
}

function runProgress(succeed: boolean) {
  const handle = toastProgress("正在重新加载…")

  setTimeout(() => {
    if (succeed) handle.finish({ message: "已重新加载扩展、技能与模板", tone: "success" })
    else handle.finish({ message: "连接网关超时", tone: "error" })
  }, 1200)
}
</script>

<style scoped>
.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}
</style>
