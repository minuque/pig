import { afterEach, describe, expect, it, vi } from "vitest";
import { clearNotices, dismissNotice, noticeQueue, notify } from "@components/ui/alert/notify.js";

describe("notify queue", () => {
  afterEach(() => {
    clearNotices();
    vi.useRealTimers();
  });

  it("pushes trimmed error notices", () => {
    notify.error("  添加目录失败  ");
    expect(noticeQueue.value).toEqual([
      { id: expect.any(Number), message: "添加目录失败", variant: "destructive" },
    ]);
  });

  it("ignores blank messages", () => {
    notify.error("   ");
    expect(noticeQueue.value).toEqual([]);
  });

  it("dismisses a notice and skips its timer", () => {
    vi.useFakeTimers();
    notify.error("boom");
    const id = noticeQueue.value[0]?.id;
    expect(typeof id).toBe("number");
    if (typeof id !== "number") return;
    dismissNotice(id);
    expect(noticeQueue.value).toEqual([]);
    vi.advanceTimersByTime(5000);
    expect(noticeQueue.value).toEqual([]);
  });

  it("auto-dismisses after 5 seconds", () => {
    vi.useFakeTimers();
    notify.error("timeout");
    expect(noticeQueue.value).toHaveLength(1);
    vi.advanceTimersByTime(4999);
    expect(noticeQueue.value).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(noticeQueue.value).toEqual([]);
  });
});
