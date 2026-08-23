import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveWebRoot } from "../src/main/paths.js";

const srcMainUrl = "file:///C:/repo/apps/desktop/src/main/index.js";
const resourcesPath = "C:\\installed\\pig\\resources";

describe("resolveWebRoot", () => {
  it.each([
    { isDev: true, isPackaged: false, expected: undefined },
    {
      isDev: false,
      isPackaged: false,
      expected: fileURLToPath(new URL("../../../web/dist", srcMainUrl)),
    },
    { isDev: false, isPackaged: true, expected: join(resourcesPath, "web") },
  ])("isDev=$isDev isPackaged=$isPackaged", ({ isDev, isPackaged, expected }) => {
    expect(resolveWebRoot(isDev, isPackaged, srcMainUrl, resourcesPath)).toBe(expected);
  });
});
