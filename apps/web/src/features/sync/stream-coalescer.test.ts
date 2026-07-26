import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamCoalescer } from "@/features/sync/stream-coalescer";

describe("StreamCoalescer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces rapid offers into one commit per 75ms window, latest wins", () => {
    const commits: number[] = [];
    const coalescer = new StreamCoalescer<number>(75, (value) =>
      commits.push(value),
    );
    coalescer.offer(1, "coalesce");
    coalescer.offer(2, "coalesce");
    vi.advanceTimersByTime(74);
    expect(commits).toEqual([]);
    coalescer.offer(3, "coalesce");
    vi.advanceTimersByTime(1);
    expect(commits).toEqual([3]);
    coalescer.dispose();
  });

  it("starts a fresh window after each flush", () => {
    const commits: number[] = [];
    const coalescer = new StreamCoalescer<number>(75, (value) =>
      commits.push(value),
    );
    coalescer.offer(1, "coalesce");
    vi.advanceTimersByTime(75);
    coalescer.offer(2, "coalesce");
    vi.advanceTimersByTime(75);
    expect(commits).toEqual([1, 2]);
    coalescer.dispose();
  });

  it("commits a final chunk immediately, flushing pending state first", () => {
    const commits: number[] = [];
    const coalescer = new StreamCoalescer<number>(75, (value) =>
      commits.push(value),
    );
    coalescer.offer(1, "coalesce");
    coalescer.offer(2, "immediate");
    expect(commits).toEqual([1, 2]);
    expect(coalescer.hasPending).toBe(false);
    vi.advanceTimersByTime(500);
    expect(commits).toEqual([1, 2]);
    coalescer.dispose();
  });

  it("commits immediate offers synchronously when nothing is pending", () => {
    const commits: number[] = [];
    const coalescer = new StreamCoalescer<number>(75, (value) =>
      commits.push(value),
    );
    coalescer.offer(9, "immediate");
    expect(commits).toEqual([9]);
    coalescer.dispose();
  });

  it("discards pending state without committing (wholesale reset)", () => {
    const commits: number[] = [];
    const coalescer = new StreamCoalescer<number>(75, (value) =>
      commits.push(value),
    );
    coalescer.offer(1, "coalesce");
    coalescer.discard();
    vi.advanceTimersByTime(500);
    expect(commits).toEqual([]);
  });

  it("rejects non-positive intervals", () => {
    expect(() => new StreamCoalescer(0, () => {})).toThrow(RangeError);
  });
});
