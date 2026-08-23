import { estimateTokens } from "@earendil-works/pi-coding-agent";

export interface ContextUsageEstimate {
  used: number;
  window: number;
  segments: {
    systemPrompt: number;
    memory: number;
    tools: number;
    conversation: number;
    other: number;
    idle: number;
  };
}

type EstimableMessage = Parameters<typeof estimateTokens>[0];

interface ContextUsageSource {
  systemPrompt: string;
  messages: EstimableMessage[];
  model: { contextWindow?: number } | undefined;
  getContextUsage(): { tokens: number | null; contextWindow: number } | undefined;
  getActiveToolNames(): string[];
  getAllTools(): Array<{
    name: string;
    description: string;
    parameters: unknown;
  }>;
  resourceLoader: {
    getAgentsFiles(): { agentsFiles: Array<{ path: string; content: string }> };
    getSkills(): {
      skills: Array<{
        name: string;
        description: string;
        filePath: string;
        disableModelInvocation: boolean;
      }>;
    };
  };
}

const USED_KEYS = ["systemPrompt", "memory", "tools", "conversation"] as const;

function estimateText(text: string): number {
  return Math.ceil(text.length / 4);
}

function memoryText(source: ContextUsageSource): string {
  const files = source.resourceLoader
    .getAgentsFiles()
    .agentsFiles.map(({ path, content }) => `${path}\n${content}`);
  const skills = source.getActiveToolNames().includes("read")
    ? source.resourceLoader
        .getSkills()
        .skills.filter((skill) => !skill.disableModelInvocation)
        .map((skill) => `${skill.name}\n${skill.description}\n${skill.filePath}`)
    : [];
  return [...files, ...skills].join("\n");
}

function activeToolsText(source: ContextUsageSource): string {
  const active = new Set(source.getActiveToolNames());
  const tools = source
    .getAllTools()
    .filter((tool) => active.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    }));
  return tools.length > 0 ? JSON.stringify(tools) : "";
}

function fitKnownSegments(
  segments: Record<(typeof USED_KEYS)[number], number>,
  used: number,
): Record<(typeof USED_KEYS)[number], number> {
  const known = USED_KEYS.reduce((sum, key) => sum + segments[key], 0);
  if (known <= used || known === 0) return segments;
  const scale = used / known;
  return Object.fromEntries(
    USED_KEYS.map((key) => [key, Math.floor(segments[key] * scale)]),
  ) as Record<(typeof USED_KEYS)[number], number>;
}

/**
 * 以 Pi 的总占用校准 chars/4 分段估算。来源估算超过总量时按比例收缩；
 * 低于总量时差额归入「其他」，保证分段互斥且总和等于窗口。
 */
export function estimateContextUsage(source: ContextUsageSource): ContextUsageEstimate {
  const systemPromptTotal = estimateText(source.systemPrompt);
  const memory = Math.min(systemPromptTotal, estimateText(memoryText(source)));
  const raw = {
    systemPrompt: systemPromptTotal - memory,
    memory,
    tools: estimateText(activeToolsText(source)),
    conversation: source.messages.reduce((sum, message) => sum + estimateTokens(message), 0),
  };
  const reported = source.getContextUsage();
  const known = USED_KEYS.reduce((sum, key) => sum + raw[key], 0);
  const reportedTokens = reported?.tokens;
  const used = Math.max(
    0,
    Math.round(typeof reportedTokens === "number" && reportedTokens > 0 ? reportedTokens : known),
  );
  const window = Math.max(0, reported?.contextWindow ?? source.model?.contextWindow ?? 0);
  const fitted = fitKnownSegments(raw, used);
  const fittedKnown = USED_KEYS.reduce((sum, key) => sum + fitted[key], 0);

  return {
    used,
    window,
    segments: {
      ...fitted,
      other: Math.max(0, used - fittedKnown),
      idle: Math.max(0, window - used),
    },
  };
}
