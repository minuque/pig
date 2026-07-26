import type {
  CursorPage,
  OpaqueCursor,
  SessionId,
  SessionSnapshot,
  TranscriptItem,
} from "@no-pi-no-gang/contracts";
import type { QueryClient } from "@tanstack/vue-query";
import { gatewayKeys } from "@/lib/gateway/keys";

/**
 * Durable Transcript cache shape owned by Vue Query. The latest tail is
 * always re-fetchable via REST; older pages are prepended on demand, and
 * committed items are appended from verified SSE payloads (deduplicated by
 * entryId). Nothing here is a second source of truth — a refetch replaces
 * the whole entry with Gateway state.
 */
export interface TranscriptCacheData {
  items: TranscriptItem[];
  /** Cursor towards older history; null when the head is reached. */
  previousCursor: OpaqueCursor | null;
  historyTruncated: boolean;
}

export function transcriptCacheFromPage(page: CursorPage<TranscriptItem>): TranscriptCacheData {
  return {
    items: page.items,
    previousCursor: page.nextCursor,
    historyTruncated: false,
  };
}

/** Seed the cache from a verified snapshot tail. */
export function seedTranscriptFromSnapshot(
  queryClient: QueryClient,
  sessionId: SessionId,
  snapshot: SessionSnapshot,
): void {
  const data: TranscriptCacheData = {
    items: snapshot.transcriptTail,
    previousCursor: snapshot.previousTranscriptCursor,
    historyTruncated: snapshot.historyTruncated,
  };
  queryClient.setQueryData(gatewayKeys.sessions.transcript(sessionId), data);
}

/** Prepend an older page; entryIds already present are not duplicated. */
export function prependOlderTranscriptPage(
  queryClient: QueryClient,
  sessionId: SessionId,
  page: CursorPage<TranscriptItem>,
): void {
  queryClient.setQueryData<TranscriptCacheData>(
    gatewayKeys.sessions.transcript(sessionId),
    (current) => {
      if (!current) return transcriptCacheFromPage(page);
      const known = new Set(current.items.map((item) => item.entryId));
      const older = page.items.filter((item) => !known.has(item.entryId));
      return {
        items: [...older, ...current.items],
        previousCursor: page.nextCursor,
        historyTruncated: current.historyTruncated,
      };
    },
  );
}

/**
 * Append a durable committed item observed on the event stream. Returns false
 * when no cache exists yet (caller should invalidate so a real fetch defines
 * the truth), true when the item was installed or already present.
 */
export function appendCommittedTranscriptItem(
  queryClient: QueryClient,
  sessionId: SessionId,
  item: TranscriptItem,
): boolean {
  const existing = queryClient.getQueryData<TranscriptCacheData>(
    gatewayKeys.sessions.transcript(sessionId),
  );
  if (!existing) return false;
  if (existing.items.some((entry) => entry.entryId === item.entryId)) {
    return true;
  }
  queryClient.setQueryData<TranscriptCacheData>(gatewayKeys.sessions.transcript(sessionId), {
    ...existing,
    items: [...existing.items, item],
  });
  return true;
}
