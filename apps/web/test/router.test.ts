import { describe, expect, it, vi } from "vitest";

vi.mock("vue-router", () => ({
  createRouter: (options: { routes: Array<{ path: string }> }) => options,
  createWebHistory: () => "history",
}));

import router from "@router/index.js";

describe("router canonical paths", () => {
  it("keeps only / and the session route", () => {
    const routes = (router as unknown as { routes: Array<{ path: string }> }).routes;
    expect(routes.map(({ path }) => path).sort()).toEqual(["/", "/sessions/:sessionId"]);
  });
});
