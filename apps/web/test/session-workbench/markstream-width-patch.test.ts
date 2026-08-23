import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const timelineBundle = readFileSync(
  fileURLToPath(new URL("../../node_modules/markstream-vue/dist/index8.js", import.meta.url)),
  "utf8",
);

describe("markstream timeline width patch", () => {
  it("measures rows by their content width instead of the outer scroll root", () => {
    expect(timelineBundle).toMatch(
      /querySelector\("\.markstream-virtual-timeline__item"\).*?clientWidth.*?Q\.value.*?clientWidth/s,
    );
  });
});
