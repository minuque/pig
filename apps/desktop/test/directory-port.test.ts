import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { canonicalizePath } from "../../../packages/gateway/src/directory.js";
import { createElectronDirectoryPort } from "../src/main/directory-port.js";

describe("createElectronDirectoryPort", () => {
  let tempRoot: string | undefined;
  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  });

  it("取消或空路径返回 undefined", async () => {
    const canceled = createElectronDirectoryPort(
      () => undefined,
      async () => ({ canceled: true, filePaths: [] }),
    );
    expect(await canceled.selectDirectory()).toBeUndefined();

    const empty = createElectronDirectoryPort(
      () => undefined,
      async () => ({ canceled: false, filePaths: [] }),
    );
    expect(await empty.selectDirectory()).toBeUndefined();
  });

  it("选中目录后做 realpath 规范化", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "pig-electron-dir-"));
    const selected = join(tempRoot, "workspace");
    await mkdir(selected);
    const expected = canonicalizePath(await realpath(selected));
    const port = createElectronDirectoryPort(
      () => undefined,
      async () => ({ canceled: false, filePaths: [selected] }),
    );
    expect(await port.selectDirectory()).toBe(expected);
  });
});
