import { describe, expect, it } from "vitest";
import { ref } from "vue";
import type { SessionId } from "@no-pi-no-gang/contracts";
import { useDraft } from "@/features/session/draft-registry";

const sid = (value: string): SessionId => value as SessionId;

describe("draft registry", () => {
  it("keeps drafts per session across session switches", () => {
    const current = ref<SessionId | undefined>(sid("draft_session_a"));
    const handle = useDraft(current);
    handle.text.value = "草稿 A";
    current.value = sid("draft_session_b");
    expect(handle.text.value).toBe("");
    handle.text.value = "草稿 B";
    current.value = sid("draft_session_a");
    expect(handle.text.value).toBe("草稿 A");
    current.value = sid("draft_session_b");
    expect(handle.text.value).toBe("草稿 B");
    handle.clear();
  });

  it("shares one draft between handles of the same session", () => {
    const current = ref<SessionId | undefined>(sid("draft_session_c"));
    const first = useDraft(current);
    const second = useDraft(current);
    first.text.value = "共享草稿";
    expect(second.text.value).toBe("共享草稿");
    second.clear();
    expect(first.text.value).toBe("");
  });

  it("clear removes the draft; empty text is never stored", () => {
    const current = ref<SessionId | undefined>(sid("draft_session_d"));
    const handle = useDraft(current);
    handle.text.value = "内容";
    handle.clear();
    expect(handle.text.value).toBe("");
    handle.text.value = "再写";
    handle.text.value = "";
    expect(handle.text.value).toBe("");
  });

  it("is a no-op without a selected session", () => {
    const current = ref<SessionId | undefined>(undefined);
    const handle = useDraft(current);
    expect(handle.text.value).toBe("");
    handle.text.value = "无处可去";
    expect(handle.text.value).toBe("");
    handle.clear();
  });
});
