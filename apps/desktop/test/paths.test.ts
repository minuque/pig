import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  WEB_ROOT_MISSING_PACKAGED,
  WEB_ROOT_MISSING_UNPACKAGED,
  resolvePreloadPath,
  resolveWebRoot,
  webRootMissingMessage,
} from "../src/main/paths.js";

const srcMainUrl = "file:///C:/repo/apps/desktop/src/main/index.js";
const outMainUrl = "file:///C:/repo/apps/desktop/out/main/index.js";
const resourcesPath = "C:\\installed\\pig\\resources";

describe("resolveWebRoot", () => {
  it("isDev 不设 webRoot", () => {
    expect(
      resolveWebRoot({
        isDev: true,
        isPackaged: false,
        moduleUrl: srcMainUrl,
        resourcesPath,
      }),
    ).toBeUndefined();
  });

  it("未打包非 dev 指向 apps/web/dist", () => {
    expect(
      resolveWebRoot({
        isDev: false,
        isPackaged: false,
        moduleUrl: srcMainUrl,
        resourcesPath,
      }),
    ).toBe(fileURLToPath(new URL("../../../web/dist", srcMainUrl)));
  });

  it("isPackaged 指向 resources/web", () => {
    expect(
      resolveWebRoot({
        isDev: false,
        isPackaged: true,
        moduleUrl: outMainUrl,
        resourcesPath,
      }),
    ).toBe(join(resourcesPath, "web"));
  });

  it("isDev 优先于 isPackaged", () => {
    expect(
      resolveWebRoot({
        isDev: true,
        isPackaged: true,
        moduleUrl: outMainUrl,
        resourcesPath,
      }),
    ).toBeUndefined();
  });
});

describe("resolvePreloadPath", () => {
  it("src/main 解析到 src/preload", () => {
    expect(resolvePreloadPath(srcMainUrl)).toBe(
      fileURLToPath(new URL("../preload/index.js", srcMainUrl)),
    );
  });

  it("out/main 解析到 out/preload", () => {
    expect(resolvePreloadPath(outMainUrl)).toBe(
      fileURLToPath(new URL("../preload/index.js", outMainUrl)),
    );
  });
});

describe("webRootMissingMessage", () => {
  it("未打包提示先 build web", () => {
    expect(webRootMissingMessage(false)).toBe(WEB_ROOT_MISSING_UNPACKAGED);
  });

  it("打包后提示安装包资源缺失", () => {
    expect(webRootMissingMessage(true)).toBe(WEB_ROOT_MISSING_PACKAGED);
  });
});
