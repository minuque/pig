/**
 * Coalesces rapid Live Overlay commits (token deltas) into at most one store
 * update per interval. Non-delta events are offered as "immediate": they
 * flush any pending coalesced state first and commit synchronously, so final
 * chunks and phase boundaries are never delayed.
 */
export class StreamCoalescer<T> {
  #pending: T | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  readonly #intervalMs: number;
  readonly #commit: (value: T) => void;

  constructor(intervalMs: number, commit: (value: T) => void) {
    if (!Number.isFinite(intervalMs) || intervalMs < 1) {
      throw new RangeError("intervalMs must be a positive number");
    }
    this.#intervalMs = intervalMs;
    this.#commit = commit;
  }

  get hasPending(): boolean {
    return this.#pending !== null;
  }

  offer(value: T, mode: "coalesce" | "immediate"): void {
    if (mode === "immediate") {
      this.#discardTimer();
      if (this.#pending !== null) {
        const pending = this.#pending;
        this.#pending = null;
        this.#commit(pending);
      }
      this.#commit(value);
      return;
    }
    this.#pending = value;
    if (this.#timer === null) {
      this.#timer = setTimeout(() => this.flush(), this.#intervalMs);
    }
  }

  flush(): void {
    this.#discardTimer();
    if (this.#pending !== null) {
      const pending = this.#pending;
      this.#pending = null;
      this.#commit(pending);
    }
  }

  /** Drop pending state without committing (used on wholesale reset). */
  discard(): void {
    this.#discardTimer();
    this.#pending = null;
  }

  dispose(): void {
    this.discard();
  }

  #discardTimer(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}
