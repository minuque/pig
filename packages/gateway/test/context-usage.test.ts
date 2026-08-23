import { describe, expect, it } from "vitest";
import { estimateContextUsage, resolveUsedTokens } from "../src/pi/context-usage.js";

function source(overrides: Record<string, unknown> = {}) {
  return {
    systemPrompt: "s".repeat(400),
    messages: [{ role: "user" as const, content: "m".repeat(80), timestamp: 1 }],
    model: { contextWindow: 1000 },
    getContextUsage: () => ({ tokens: 300, contextWindow: 1000, percent: 30 }),
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
      getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }),
    });
    const withHidden = estimateContextUsage({
      ...base,
      getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }),
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

  it("来源估算超过上报总量时仅收缩会话分段", () => {
    const estimated = estimateContextUsage(
      source({ getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }) }),
    );
    const fixed =
      estimated.segments.systemPrompt + estimated.segments.memory + estimated.segments.tools;
    const target = fixed + Math.floor(estimated.segments.conversation / 2);
    const usage = estimateContextUsage(
      source({ getContextUsage: () => ({ tokens: target, contextWindow: 1000, percent: null }) }),
    );

    expect(usage.used).toBe(target);
    expect(usage.segments.systemPrompt).toBe(estimated.segments.systemPrompt);
    expect(usage.segments.memory).toBe(estimated.segments.memory);
    expect(usage.segments.tools).toBe(estimated.segments.tools);
    expect(usage.segments.conversation).toBe(target - fixed);
  });

  it("总占用不低于固定分段", () => {
    const estimated = estimateContextUsage(
      source({ getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }) }),
    );
    const fixed =
      estimated.segments.systemPrompt + estimated.segments.memory + estimated.segments.tools;
    const usage = estimateContextUsage(
      source({
        getContextUsage: () => ({ tokens: fixed - 1, contextWindow: 1000, percent: null }),
      }),
    );

    expect(usage.used).toBe(fixed);
    expect(usage.segments.conversation).toBe(0);
  });
});

describe("resolveUsedTokens", () => {
  it("上报 tokens 与 percent 显著不一致时优先 percent", () => {
    expect(resolveUsedTokens({ tokens: 1, percent: 7 }, 20_000, 272_000)).toBe(19_040);
    expect(resolveUsedTokens({ tokens: 19_000, percent: 7 }, 20_000, 272_000)).toBe(19_000);
  });

  it("上报值明显小于内容估算时回退估算", () => {
    expect(resolveUsedTokens({ tokens: 1, percent: 1 / 2720 }, 20_000, 272_000)).toBe(20_000);
    expect(resolveUsedTokens({ tokens: null, percent: null }, 20_000, 272_000)).toBe(20_000);
  });
});
