import { describe, expect, it } from "vitest";
import { estimateContextUsage } from "../src/pi/context-usage.js";

function source(overrides: Record<string, unknown> = {}) {
  return {
    systemPrompt: "s".repeat(400),
    messages: [{ role: "user" as const, content: "m".repeat(80), timestamp: 1 }],
    model: { contextWindow: 1000 },
    getContextUsage: () => ({ tokens: 300, contextWindow: 1000 }),
    getActiveToolNames: () => ["read"],
    getAllTools: () => [{ name: "read", description: "Read a file", parameters: {} }],
    resourceLoader: {
      getAgentsFiles: () => ({
        agentsFiles: [{ path: "AGENTS.md", content: "a".repeat(80) }],
      }),
      getSkills: () => ({
        skills: [
          {
            name: "review",
            description: "Review code",
            filePath: "/skills/review/SKILL.md",
            disableModelInvocation: false,
          },
        ],
      }),
    },
    ...overrides,
  };
}

describe("estimateContextUsage", () => {
  it("以 Pi 总占用校准来源估算，差额归入其他，剩余归入空闲", () => {
    const usage = estimateContextUsage(source());
    const { idle, ...usedSegments } = usage.segments;
    expect(usage.used).toBe(300);
    expect(usage.window).toBe(1000);
    expect(Object.values(usedSegments).reduce((sum, value) => sum + value, 0)).toBe(300);
    expect(idle).toBe(700);
    expect(usage.segments.systemPrompt).toBeGreaterThan(0);
    expect(usage.segments.memory).toBeGreaterThan(0);
    expect(usage.segments.tools).toBeGreaterThan(0);
    expect(usage.segments.conversation).toBeGreaterThan(0);
  });

  it("总量未知时使用所有来源估算，并忽略不进系统提示词的 skill", () => {
    const base = source();
    const withoutHidden = estimateContextUsage({
      ...base,
      getContextUsage: () => ({ tokens: null, contextWindow: 1000 }),
    });
    const withHidden = estimateContextUsage({
      ...base,
      getContextUsage: () => ({ tokens: null, contextWindow: 1000 }),
      resourceLoader: {
        ...base.resourceLoader,
        getSkills: () => ({
          skills: [
            ...base.resourceLoader.getSkills().skills,
            {
              name: "hidden",
              description: "x".repeat(200),
              filePath: "/hidden/SKILL.md",
              disableModelInvocation: true,
            },
          ],
        }),
      },
    });
    expect(withHidden).toEqual(withoutHidden);
    expect(withoutHidden.segments.other).toBe(0);
  });

  it("来源估算超过上报总量时收缩分段且不产生负数", () => {
    const usage = estimateContextUsage(
      source({ getContextUsage: () => ({ tokens: 20, contextWindow: 10 }) }),
    );
    const { idle, ...usedSegments } = usage.segments;
    expect(Object.values(usedSegments).reduce((sum, value) => sum + value, 0)).toBe(20);
    expect(usage.segments.other).toBeGreaterThanOrEqual(0);
    expect(idle).toBe(0);
  });
});
