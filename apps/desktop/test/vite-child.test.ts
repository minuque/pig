import { describe, expect, it } from "vitest";
import { nodeExecutable, pnpmExecutable } from "../src/main/vite-child.js";

describe("vite-child executables", () => {
  it("nodeExecutable 使用 npm_node_execpath，不用 electron 本体", () => {
    expect(nodeExecutable({ npm_node_execpath: "C:/nodejs/node.exe" })).toBe("C:/nodejs/node.exe");
    expect(() => nodeExecutable({})).toThrow(/npm_node_execpath/);
  });

  it("pnpmExecutable 读取 npm_execpath", () => {
    expect(pnpmExecutable({ npm_execpath: "C:/pnpm/pnpm.cjs" })).toBe("C:/pnpm/pnpm.cjs");
    expect(() => pnpmExecutable({})).toThrow(/npm_execpath/);
  });
});
