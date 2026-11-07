<template>
  <section class="pane">
    <section class="group">
      <h2 class="group-title">{{ t("settings.notifications") }}</h2>

      <Card size="s" class="card">
        <div id="setting-notify-system" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.notifySystem") }}</h3>
            <p class="hint">{{ t("settings.notifySystemHint") }}</p>
          </div>

          <Switch
            :aria-label="t('settings.notifySystem')"
            :model-value="notifyOn"
            @update:model-value="onNotify"
          />
        </div>

        <div id="setting-notify-sound" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.notifySound") }}</h3>
            <p class="hint">{{ t("settings.notifySoundHint") }}</p>
          </div>

          <Switch
            :aria-label="t('settings.notifySound')"
            :model-value="soundOn"
            @update:model-value="toggleSound()"
          />
        </div>
      </Card>
    </section>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { useSound } from "@features/click-sound/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import { Switch } from "@components/ui/switch/index.js"
import { Card } from "@components/ui/card/index.js"

const { t } = useI18n()
const { enabled: soundOn, toggle: toggleSound } = useSound()
const { notifyOn, setNotify } = useGeneralPrefs()

/** 开启系统通知前先要权限，拒绝就不落开关。 */
async function onNotify(next: boolean) {
  if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
    const result = await Notification.requestPermission()

    if (result !== "granted") return
  }

  setNotify(next)
}
</script>

<style scoped src="./pane.css"></style>
