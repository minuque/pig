import type { SessionId } from "@no-pi-no-gang/contracts";
import { computed, type Ref, reactive, type WritableComputedRef } from "vue";

/**
 * Composer draft registry: purely in-memory, keyed by Session ID. Drafts
 * survive Session switches within the page lifetime, are never persisted,
 * never shared across Sessions, and never leave the browser.
 */
const drafts = reactive(new Map<SessionId, string>());

export interface DraftHandle {
  text: WritableComputedRef<string>;
  clear: () => void;
}

export function useDraft(sessionId: Ref<SessionId | undefined>): DraftHandle {
  const text = computed<string>({
    get: () => {
      const id = sessionId.value;
      return id === undefined ? "" : (drafts.get(id) ?? "");
    },
    set: (value: string) => {
      const id = sessionId.value;
      if (id === undefined) return;
      if (value === "") drafts.delete(id);
      else drafts.set(id, value);
    },
  });
  const clear = () => {
    const id = sessionId.value;
    if (id !== undefined) drafts.delete(id);
  };
  return { text, clear };
}
