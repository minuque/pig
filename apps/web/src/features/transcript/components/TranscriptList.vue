<script lang="ts">
import type { SessionId } from "@no-pi-no-gang/contracts";

/**
 * Per-Session scroll memory: purely in-memory, keyed by Session ID.
 * Positions survive Session switches and remounts within the page lifetime,
 * are never persisted, and are never shared across Sessions.
 */
interface TranscriptScrollPosition {
  scrollTop: number;
  nearTail: boolean;
}

const scrollPositions = new Map<SessionId, TranscriptScrollPosition>();
</script>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type { TranscriptEntry } from "@/features/session/use-session-view";
import TranscriptItem from "@/features/transcript/components/TranscriptItem.vue";

/**
 * Scrollable Transcript. While the user is near the tail, new entries and
 * in-place live updates keep the view pinned to the bottom; after scrolling
 * up, updates no longer yank the scroll position — a "jump to latest"
 * button appears instead. Scroll positions are saved and restored per
 * Session. Screen readers get only coarse phase announcements (never
 * per-token) through a visually hidden polite status region.
 */
const props = defineProps<{
  entries: TranscriptEntry[];
  pending: boolean;
  canLoadOlder: boolean;
  historyTruncated: boolean;
  liveAnnouncement: string;
  sessionId: SessionId;
}>();
const emit = defineEmits<{ loadOlder: [] }>();

const scroller = ref<HTMLElement | null>(null);
const nearTail = ref(true);
const jumpVisible = ref(false);
const NEAR_TAIL_PX = 96;

function distanceFromTail(): number {
  const el = scroller.value;
  if (!el) return 0;
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

function onScroll(): void {
  nearTail.value = distanceFromTail() <= NEAR_TAIL_PX;
  if (nearTail.value) jumpVisible.value = false;
}

async function scrollToTail(): Promise<void> {
  await nextTick();
  const el = scroller.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
  nearTail.value = true;
  jumpVisible.value = false;
}

function savePosition(sessionId: SessionId): void {
  const el = scroller.value;
  if (!el) return;
  scrollPositions.set(sessionId, {
    scrollTop: el.scrollTop,
    nearTail: nearTail.value,
  });
}

function restorePosition(sessionId: SessionId): void {
  const el = scroller.value;
  const saved = scrollPositions.get(sessionId);
  if (!el || !saved || saved.nearTail) {
    // Unvisited or tail-pinned Session: follow the tail again.
    void scrollToTail();
    return;
  }
  el.scrollTop = saved.scrollTop;
  nearTail.value = false;
  jumpVisible.value = false;
}

let switchingSession = false;

watch(
  () => props.sessionId,
  async (next, previous) => {
    savePosition(previous);
    switchingSession = true;
    await nextTick();
    restorePosition(next);
    switchingSession = false;
  },
);

/**
 * Follow signal: entry identity plus live content sizes, so token updates
 * to an existing live entry trigger tail-follow even when the entry count
 * is unchanged.
 */
const followSignal = computed(() =>
  props.entries
    .map((entry) =>
      entry.kind === "durable"
        ? entry.key
        : `${entry.key}:${entry.run.text.length}:${entry.run.thinking.length}:${entry.run.toolOrder.length}`,
    )
    .join("|"),
);

watch(followSignal, () => {
  if (switchingSession) return;
  if (nearTail.value) void scrollToTail();
  else jumpVisible.value = true;
});

onMounted(() => {
  restorePosition(props.sessionId);
});

onBeforeUnmount(() => {
  // Template listeners detach with the component; the position registry is
  // per-process and intentionally survives the unmount.
  savePosition(props.sessionId);
});
</script>

<template>
  <div class="transcript">
    <p class="visually-hidden" role="status">{{ liveAnnouncement }}</p>

    <div ref="scroller" class="transcript-scroll" @scroll.passive="onScroll">
      <div class="transcript-head">
        <button
          v-if="canLoadOlder"
          type="button"
          class="btn btn-ghost"
          @click="emit('loadOlder')"
        >
          加载更早的消息
        </button>
        <p v-if="historyTruncated" class="truncated-note">
          更早的历史记录已截断，仅显示最近内容。
        </p>
      </div>

      <p v-if="pending" class="transcript-empty" role="status">正在加载…</p>
      <p v-else-if="entries.length === 0" class="transcript-empty">
        还没有消息。发送第一条 Prompt 开始。
      </p>

      <ul v-else class="transcript-list">
        <li v-for="entry in entries" :key="entry.key">
          <TranscriptItem :entry="entry" />
        </li>
      </ul>
    </div>

    <button
      v-if="jumpVisible"
      type="button"
      class="btn jump-latest"
      @click="scrollToTail"
    >
      跳转到最新
    </button>
  </div>
</template>

<style scoped>
.transcript {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.transcript-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
}

.transcript-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.truncated-note {
  font-size: var(--text-xs);
  color: var(--color-foreground-muted);
}

.transcript-empty {
  color: var(--color-foreground-muted);
  text-align: center;
  padding: var(--space-6) 0;
}

.transcript-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 860px;
}

.jump-latest {
  position: absolute;
  right: var(--space-4);
  bottom: var(--space-4);
  box-shadow: var(--shadow-overlay);
}
</style>
