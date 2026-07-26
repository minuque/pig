import type { Instant } from "@no-pi-no-gang/contracts";

export interface Clock {
  now(): Instant;
}

export class StableClock implements Clock {
  #milliseconds: number;

  constructor(initial: string = "2025-01-02T03:04:05.000Z") {
    const milliseconds = Date.parse(initial);
    if (!Number.isFinite(milliseconds))
      throw new TypeError("initial must be an RFC 3339 timestamp");
    this.#milliseconds = milliseconds;
  }

  now(): Instant {
    return new Date(this.#milliseconds).toISOString();
  }

  advance(milliseconds: number): Instant {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new RangeError("milliseconds must be a non-negative safe integer");
    }
    this.#milliseconds += milliseconds;
    return this.now();
  }
}
