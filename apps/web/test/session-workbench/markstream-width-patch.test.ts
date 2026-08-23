import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const timelineBundle = readFileSync(
  fileURLToPath(new URL("../../node_modules/markstream-vue/dist/index8.js", import.meta.url)),
  "utf8",
);

describe("markstream timeline width patch", () => {
  const widthFunctions = timelineBundle.match(
    /function refreshMeasuredWidth\(\)\{(?<refresh>.*?)\}function It\(\)\{(?<read>.*?)\}function zt/s,
  );

  function widthHarness(itemWidth: number, rootWidth: number) {
    const refresh = widthFunctions?.groups?.refresh;
    const read = widthFunctions?.groups?.read;
    if (!refresh || !read) throw new Error("width measurement functions not found");
    return Function(
      "itemWidth",
      "rootWidth",
      `let queries = 0;
       const root = {
         clientWidth: rootWidth,
         querySelector() { queries += 1; return { clientWidth: itemWidth }; }
       };
       const Q = { value: root };
       const ee = { value: 0 };
       let measuredWidth = 0;
       function refreshMeasuredWidth() { ${refresh} }
       function It() { ${read} }
       return {
         refresh() { refreshMeasuredWidth(); return ee.value; },
         read() { It(); return ee.value; },
         queries() { return queries; }
       };`,
    )(itemWidth, rootWidth) as {
      refresh(): number;
      read(): number;
      queries(): number;
    };
  }

  it("uses a positive row width and falls back to the scroll root for a zero-width row", () => {
    expect(widthHarness(732, 960).refresh()).toBe(736);
    expect(widthHarness(0, 960).refresh()).toBe(960);
  });

  it("reads the cached width without querying the DOM on the scroll path", () => {
    const harness = widthHarness(732, 960);
    harness.refresh();
    const queriesAfterMeasurement = harness.queries();

    expect(harness.read()).toBe(736);
    expect(harness.queries()).toBe(queriesAfterMeasurement);
  });
});
