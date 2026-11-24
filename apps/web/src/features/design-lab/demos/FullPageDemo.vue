<template>
  <div class="page-frame">
    <aside class="page-sidebar">
      <NavHeader
        v-model:search-open="searchOpen"
        v-model:scope-filter="scopeFilter"
        :groups="PAGE_GROUPS"
        :sessions="PAGE_SESSIONS"
      />

      <SessionList
        :sections="sections"
        :card-foot-by-id="PAGE_FOOTS"
        :pinned-ids="pinnedIds"
        :highlighted-session-id="PAGE_SESSION_ID"
        :expanded-sections="expanded"
        :more-by-section="{}"
        :running-since="PAGE_RUNNING_SINCE"
      />

      <NavFooter />
    </aside>

    <main class="page-main">
      <div class="page-stage">
        <TranscriptView
          :session-id="PAGE_SESSION_ID"
          :transcript="PAGE_TRANSCRIPT"
          :timings="PAGE_TIMINGS"
          running
          phase="turn"
        >
          <aside class="page-rail">
            <RailSummary
              :cwd="PAGE_GROUPS[0]!.canonicalPath"
              local-host="workstation"
              :model="PAGE_PRESET.model"
              :usage="usage"
              :session-id="PAGE_SESSION_ID"
              :sections="tasks"
              :stoppable="stoppable"
              :stopping="new Set()"
              :statuses="undefined"
            />
          </aside>

          <template #queue>
            <QueuedPanel :queue="queue" :editing-id="null" />
          </template>
        </TranscriptView>
      </div>

      <div class="page-composer">
        <Composer
          v-model:prompt="prompt"
          v-model:preset="preset"
          :catalog="PAGE_CATALOG"
          :attachments="attachments"
          :usage="usage"
          running
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef } from "vue"
import Composer from "@features/composer/index.vue"
import { useComposerAttachments } from "@features/composer/hooks/use-composer-attachments.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import NavHeader from "@features/session-nav/components/NavHeader.vue"
import SessionList from "@features/session-nav/components/SessionList.vue"
import { sidebarSections } from "@features/session-nav/lib/session-list.js"
import { projectContextUsage } from "@features/session/lib/context-usage.js"
import RailSummary from "@features/session-rail/components/RailSummary.vue"
import { provideSessionRail } from "@features/session-rail/index.js"
import { taskSections } from "@features/session-rail/lib/task-list.js"
import QueuedPanel from "@features/session-workbench/components/QueuedPanel.vue"
import TranscriptView from "@features/transcript-view/index.vue"
import {
  PAGE_CATALOG,
  PAGE_FOOTS,
  PAGE_GROUPS,
  PAGE_PINNED,
  PAGE_PRESET,
  PAGE_RUNNING_SINCE,
  PAGE_SESSION_ID,
  PAGE_SESSIONS,
  PAGE_TASKS,
  PAGE_TIMINGS,
  PAGE_TRANSCRIPT,
  PAGE_USAGE,
  pagePlacement,
} from "@features/design-lab/lib/page-fixtures.js"

provideSessionRail()

const searchOpen = ref(false)
const scopeFilter = shallowRef<ReadonlySet<string>>(new Set())
const sections = sidebarSections({
  sessions: PAGE_SESSIONS,
  pinnedOrder: PAGE_PINNED,
  placement: pagePlacement,
  moreBySection: {},
})
const pinnedIds = new Set(PAGE_PINNED)
const expanded = new Set(sections.map((section) => section.key))
const usage = projectContextUsage(PAGE_USAGE)
const tasks = taskSections(PAGE_TASKS)
const stoppable = new Set(tasks.running.map((task) => task.id))
const attachments = useComposerAttachments()
const queue = useComposerQueue()
const prompt = ref("把 compact 的头部高也对齐到 40px")
const preset = ref(PAGE_PRESET)

queue.enqueue("跑完测试后截一张 compact 的图")
</script>

<style scoped>
.page-frame {
  display: flex;
  block-size: 880px;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--bg);
  box-shadow: 0 0 0 var(--border-width) var(--border);
}

.page-sidebar {
  display: flex;
  flex: none;
  flex-direction: column;
  inline-size: 280px;
  min-block-size: 0;
  background: var(--sidebar);
  border-inline-end: var(--border-width) solid var(--border-subtle);
}

.page-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}

.page-stage {
  display: flex;
  flex: 1;
  min-block-size: 0;
}

.page-rail {
  inline-size: var(--rail-width);
  min-block-size: 0;
  padding: var(--space-xs) var(--border-width) var(--space-sm);
  overflow-y: auto;
  scrollbar-width: none;
}

.page-composer {
  inline-size: min(100%, var(--content-width));
  margin-inline: auto;
  padding: 0 var(--space-md) var(--space-md);
}
</style>
