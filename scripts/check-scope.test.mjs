import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyTouched } from "./check-scope.mjs";

describe("classifyTouched", () => {
  it("只映射脏文件所属包", () => {
    const scope = classifyTouched(["apps/web/src/client/transport.ts", "apps/web/test/x.ts"]);
    assert.deepEqual(scope.packages, ["@pig/web"]);
    assert.equal(scope.escalate, false);
    assert.deepEqual(scope.lintFiles, ["apps/web/src/client/transport.ts", "apps/web/test/x.ts"]);
  });

  it("根配置改动升级全量 check", () => {
    assert.equal(classifyTouched(["eslint.config.js"]).escalate, true);
    assert.equal(classifyTouched(["package.json"]).escalate, true);
  });

  it("删除的包内路径仍映射到所属包", () => {
    const scope = classifyTouched(["apps/web/src/gone.vue"]);
    assert.deepEqual(scope.packages, ["@pig/web"]);
    assert.deepEqual(scope.lintFiles, ["apps/web/src/gone.vue"]);
    assert.deepEqual(scope.prettierFiles, ["apps/web/src/gone.vue"]);
  });

  it("DESIGN.md 触发 designmd 与 token", () => {
    const scope = classifyTouched(["DESIGN.md"]);
    assert.equal(scope.designmd, true);
    assert.equal(scope.tokens, true);
    assert.deepEqual(scope.packages, []);
  });
});
