import { describe, expect, it } from "vitest";
import { EventHub } from "../src/stream/hub.js";

function event(type: string) {
  return { type, payload: { type } };
}

describe("EventHub", () => {
  it("replays from a cursor and returns reset-required for stale or foreign cursors", () => {
    const hub = new EventHub("epoch_test", 2);
    const first = hub.publish(event("one"));
    const second = hub.publish(event("two"));
    const third = hub.publish(event("three"));
    expect(hub.replay(`${hub.epoch}:1`)?.map((x) => x.type)).toEqual(["two", "three"]);
    expect(hub.replay(`${hub.epoch}:0`)).toBeNull();
    expect(hub.replay(`other:1`)).toBeNull();
    expect(hub.replay(`${hub.epoch}:3`)).toEqual([]);
    expect(first.gatewaySeq).toBe(1);
    expect(second.gatewaySeq).toBe(2);
    expect(third.gatewaySeq).toBe(3);
  });

  it("drops a slow subscriber at its bounded queue and reports the latest cursor", async () => {
    const hub = new EventHub("epoch_slow", 10);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const received: string[] = [];
    const lags: string[] = [];
    hub.subscribe(
      async (item) => {
        received.push(item.type);
        await blocked;
      },
      { maxQueue: 1, onLag: (cursor) => lags.push(cursor) },
    );
    hub.publish(event("one"));
    hub.publish(event("two"));
    hub.publish(event("three"));
    // The reset callback is serialized after the in-flight send; it must not
    // write concurrently with the blocked event.
    expect(lags).toEqual([]);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lags).toEqual(["epoch_slow:3"]);
    expect(received).toEqual(["one"]);
  });

  it("captures replay and buffers live events across the snapshot boundary", async () => {
    const hub = new EventHub("epoch_boundary", 10);
    hub.publish(event("before"));
    const received: string[] = [];
    const prepared = hub.prepareSubscription("epoch_boundary:0", async (item) => {
      received.push(item.type);
    });
    expect("reason" in prepared).toBe(false);
    if ("reason" in prepared) return;
    hub.publish(event("during"));
    expect(prepared.replay.map((item) => item.type)).toEqual(["before"]);
    expect(received).toEqual([]);
    prepared.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(received).toEqual(["during"]);
    prepared.stop();
  });
});
