import { randomUUID } from "node:crypto";

export type Event = {
  schemaVersion: number;
  contractRevision: number;
  gatewayEpoch: string;
  gatewaySeq: number;
  emittedAt: string;
  type: string;
  workspaceId?: string;
  sessionId?: string;
  runId?: string;
  runSeq?: number;
  durableEntryId?: string;
  payload: unknown;
};

export type ReplayResetReason = "cursor_invalid" | "epoch_changed" | "replay_unavailable";

type Subscriber = {
  send: (event: Event) => void | Promise<void>;
  queue: Event[];
  sending: boolean;
  paused: boolean;
  maxQueue: number;
  lagged: boolean;
  onLag?: (latestCursor: string) => void | Promise<void>;
};

export class EventHub {
  private seq = 0;
  private readonly events: Event[] = [];
  private readonly clients = new Set<Subscriber>();

  constructor(
    readonly epoch = randomUUID(),
    private readonly max = 1000,
    private readonly defaultClientQueue = 256,
  ) {}

  cursor(): string {
    return `${this.epoch}:${this.seq}`;
  }

  oldestCursor(): string | undefined {
    const first = this.events[0];
    return first ? `${this.epoch}:${first.gatewaySeq}` : undefined;
  }

  publish(
    input: Omit<
      Event,
      "schemaVersion" | "contractRevision" | "gatewayEpoch" | "gatewaySeq" | "emittedAt"
    >,
  ): Event {
    const event: Event = {
      ...input,
      schemaVersion: 1,
      contractRevision: 1,
      gatewayEpoch: this.epoch,
      gatewaySeq: ++this.seq,
      emittedAt: new Date().toISOString(),
    };
    this.events.push(event);
    if (this.events.length > this.max) this.events.shift();
    for (const client of this.clients) this.enqueue(client, event);
    return event;
  }

  replay(after?: string): Event[] | null {
    return this.replayResult(after).events ?? null;
  }

  replayResult(after?: string): {
    events?: Event[];
    reason?: ReplayResetReason;
  } {
    if (!after) return { events: [...this.events] };
    const separator = after.lastIndexOf(":");
    if (separator < 1) return { reason: "cursor_invalid" };
    const epoch = after.slice(0, separator);
    const sequence = Number(after.slice(separator + 1));
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      return { reason: "cursor_invalid" };
    }
    if (epoch !== this.epoch) return { reason: "epoch_changed" };
    if (this.events[0] && sequence < this.events[0].gatewaySeq - 1) {
      return { reason: "replay_unavailable" };
    }
    return {
      events: this.events.filter((event) => event.gatewaySeq > sequence),
    };
  }

  subscribe(
    send: (event: Event) => void | Promise<void>,
    options: {
      maxQueue?: number;
      onLag?: (latestCursor: string) => void | Promise<void>;
      paused?: boolean;
    } = {},
  ): () => void {
    const client: Subscriber = {
      send,
      queue: [],
      sending: false,
      paused: options.paused ?? false,
      maxQueue: options.maxQueue ?? this.defaultClientQueue,
      lagged: false,
      ...(options.onLag ? { onLag: options.onLag } : {}),
    };
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  /**
   * Atomically captures replay and installs a paused live subscriber. Calling
   * start after replay + stream.ready have been written closes the bootstrap
   * race without concurrent SSE writes.
   */
  prepareSubscription(
    after: string | undefined,
    send: (event: Event) => void | Promise<void>,
    options: {
      maxQueue?: number;
      onLag?: (latestCursor: string) => void | Promise<void>;
    } = {},
  ):
    | {
        replay: Event[];
        start: () => void;
        stop: () => void;
      }
    | { reason: ReplayResetReason } {
    const replay = this.replayResult(after);
    if (!replay.events) return { reason: replay.reason! };
    let client: Subscriber | undefined;
    const stop = this.subscribe(send, { ...options, paused: true });
    // subscribe owns the newest Set entry; capture it synchronously.
    client = [...this.clients].at(-1);
    return {
      replay: replay.events,
      start: () => {
        if (!client || !this.clients.has(client)) return;
        client.paused = false;
        if (client.queue.length > 0 && !client.sending) void this.drain(client);
      },
      stop,
    };
  }

  private enqueue(client: Subscriber, event: Event): void {
    if (!this.clients.has(client) || client.lagged) return;
    if (client.queue.length >= client.maxQueue) {
      client.lagged = true;
      this.clients.delete(client);
      client.queue.length = 0;
      if (!client.sending) void this.notifyLag(client);
      return;
    }
    client.queue.push(event);
    if (!client.paused && !client.sending) void this.drain(client);
  }

  private async notifyLag(client: Subscriber): Promise<void> {
    await client.onLag?.(this.cursor());
  }

  private async drain(client: Subscriber): Promise<void> {
    client.sending = true;
    try {
      while (this.clients.has(client) && client.queue.length > 0) {
        await client.send(client.queue.shift()!);
      }
    } finally {
      client.sending = false;
      if (client.lagged) await this.notifyLag(client);
    }
  }
}
