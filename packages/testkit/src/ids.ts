export interface IdSource {
  next(kind: string): string;
}

export class SequenceIdSource implements IdSource {
  #next: number;

  constructor(start = 1) {
    if (!Number.isSafeInteger(start) || start < 1)
      throw new RangeError("start must be a positive safe integer");
    this.#next = start;
  }

  next(kind: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(kind))
      throw new TypeError("kind must be a safe lowercase identifier");
    return `${kind}_${this.#next++}`;
  }
}
