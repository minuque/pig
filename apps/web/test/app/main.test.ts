import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(
  fileURLToPath(new URL("../../src/main.ts", import.meta.url)),
  "utf8",
);

describe("Markstream startup configuration", () => {
  it("disables Mermaid before mounting the app", () => {
    expect(mainSource).toContain('import { disableMermaid } from "markstream-vue";');
    expect(mainSource).toContain("disableMermaid();");
    expect(mainSource.indexOf("disableMermaid();")).toBeLessThan(
      mainSource.indexOf('app.mount("#app")'),
    );
  });
});
