import { describe, expect, it } from "vitest";
import {
  nodeExecutable,
  pnpmExecutable,
  prepareInheritedConsoleChunk,
} from "../src/main/vite-child.js";

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

describe("prepareInheritedConsoleChunk", () => {
  it("去掉 ANSI 并把 \\r 收成换行，保留 UTF-8 箭头", () => {
    const raw = Buffer.from(
      "\r\n  \u001B[32m\u001B[1mVITE\u001B[22m v8.1.5\u001B[39m  \u001B[2mready in \u001B[0m\u001B[1m614\u001B[22m\u001B[2mms\u001B[22m\r\n\r\n  \u001B[32m➜\u001B[39m  \u001B[1mLocal\u001B[22m:   \u001B[36mhttp://localhost:5173/\u001B[39m\r",
      "utf8",
    );
    expect(prepareInheritedConsoleChunk(raw)).toBe(
      "\n  VITE v8.1.5  ready in 614ms\n\n  ➜  Local:   http://localhost:5173/\n",
    );
  });
});
