/** 供应商品牌展示：Pi provider id → 显示名 / LobeHub 图标。未知供应商回退到原 id。 */
import antgroupColor from "@lobehub/icons-static-svg/icons/antgroup-color.svg?url";
import azureColor from "@lobehub/icons-static-svg/icons/azure-color.svg?url";
import baseten from "@lobehub/icons-static-svg/icons/baseten.svg?url";
import bedrockColor from "@lobehub/icons-static-svg/icons/bedrock-color.svg?url";
import cerebrasColor from "@lobehub/icons-static-svg/icons/cerebras-color.svg?url";
import claudeColor from "@lobehub/icons-static-svg/icons/claude-color.svg?url";
import cloudflareColor from "@lobehub/icons-static-svg/icons/cloudflare-color.svg?url";
import copilotColor from "@lobehub/icons-static-svg/icons/copilot-color.svg?url";
import deepseekColor from "@lobehub/icons-static-svg/icons/deepseek-color.svg?url";
import fireworksColor from "@lobehub/icons-static-svg/icons/fireworks-color.svg?url";
import geminiColor from "@lobehub/icons-static-svg/icons/gemini-color.svg?url";
import geminicliColor from "@lobehub/icons-static-svg/icons/geminicli-color.svg?url";
import googleColor from "@lobehub/icons-static-svg/icons/google-color.svg?url";
import grok from "@lobehub/icons-static-svg/icons/grok.svg?url";
import groq from "@lobehub/icons-static-svg/icons/groq.svg?url";
import huggingfaceColor from "@lobehub/icons-static-svg/icons/huggingface-color.svg?url";
import kimiColor from "@lobehub/icons-static-svg/icons/kimi-color.svg?url";
import minimaxColor from "@lobehub/icons-static-svg/icons/minimax-color.svg?url";
import mistralColor from "@lobehub/icons-static-svg/icons/mistral-color.svg?url";
import nvidiaColor from "@lobehub/icons-static-svg/icons/nvidia-color.svg?url";
import ollama from "@lobehub/icons-static-svg/icons/ollama.svg?url";
import openai from "@lobehub/icons-static-svg/icons/openai.svg?url";
import opencode from "@lobehub/icons-static-svg/icons/opencode.svg?url";
import openrouterColor from "@lobehub/icons-static-svg/icons/openrouter-color.svg?url";
import qwenColor from "@lobehub/icons-static-svg/icons/qwen-color.svg?url";
import togetherColor from "@lobehub/icons-static-svg/icons/together-color.svg?url";
import vercel from "@lobehub/icons-static-svg/icons/vercel.svg?url";
import vertexaiColor from "@lobehub/icons-static-svg/icons/vertexai-color.svg?url";
import workersaiColor from "@lobehub/icons-static-svg/icons/workersai-color.svg?url";
import xiaomimimo from "@lobehub/icons-static-svg/icons/xiaomimimo.svg?url";
import zhipuColor from "@lobehub/icons-static-svg/icons/zhipu-color.svg?url";

export interface VendorIcon {
  src: string;
  /** true：单色 SVG，用 currentColor 上色；false：品牌彩色。 */
  tinted: boolean;
}

const NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  xai: "xAI",
  google: "Google",
  gemini: "Gemini",
  geminicli: "Gemini CLI",
  vertexai: "Vertex AI",
  azure: "Azure",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  copilot: "GitHub Copilot",
  mistral: "Mistral",
  groq: "Groq",
  bedrock: "Amazon Bedrock",
  qwen: "Qwen",
  zhipu: "Zhipu AI",
  kimi: "Kimi",
  minimax: "MiniMax",
  huggingface: "Hugging Face",
  nvidia: "NVIDIA",
  vercel: "Vercel",
  cerebras: "Cerebras",
  cloudflare: "Cloudflare",
  workersai: "Workers AI",
  fireworks: "Fireworks",
  together: "Together",
  xiaomi: "Xiaomi",
  opencode: "OpenCode",
  ollama: "Ollama",
  "ant-ling": "Ant Ling",
  baseten: "Baseten",
};

const ALIASES: Record<string, string> = {
  "azure-openai-responses": "azure",
  "openai-codex": "openai",
  "github-copilot": "copilot",
  "google-gemini-cli": "geminicli",
  "google-vertex": "vertexai",
  "amazon-bedrock": "bedrock",
  moonshot: "kimi",
  "kimi-coding": "kimi",
  "vercel-ai-gateway": "vercel",
  zai: "zhipu",
  "cloudflare-workers-ai": "workersai",
  "cloudflare-ai-gateway": "cloudflare",
  claude: "anthropic",
  "claude-code": "anthropic",
  claudecode: "anthropic",
  // OpenCode Zen 目录是 Claude 系列，和 OpenCode Go 不能共用同一套标
  opencode: "anthropic",
  "opencode-go": "opencode",
};

const ICONS: Record<string, VendorIcon> = {
  openai: { src: openai, tinted: true },
  anthropic: { src: claudeColor, tinted: false },
  xai: { src: grok, tinted: true },
  google: { src: googleColor, tinted: false },
  gemini: { src: geminiColor, tinted: false },
  geminicli: { src: geminicliColor, tinted: false },
  vertexai: { src: vertexaiColor, tinted: false },
  azure: { src: azureColor, tinted: false },
  openrouter: { src: openrouterColor, tinted: false },
  deepseek: { src: deepseekColor, tinted: false },
  copilot: { src: copilotColor, tinted: false },
  mistral: { src: mistralColor, tinted: false },
  groq: { src: groq, tinted: true },
  bedrock: { src: bedrockColor, tinted: false },
  qwen: { src: qwenColor, tinted: false },
  zhipu: { src: zhipuColor, tinted: false },
  kimi: { src: kimiColor, tinted: false },
  minimax: { src: minimaxColor, tinted: false },
  huggingface: { src: huggingfaceColor, tinted: false },
  nvidia: { src: nvidiaColor, tinted: false },
  vercel: { src: vercel, tinted: true },
  cerebras: { src: cerebrasColor, tinted: false },
  cloudflare: { src: cloudflareColor, tinted: false },
  workersai: { src: workersaiColor, tinted: false },
  fireworks: { src: fireworksColor, tinted: false },
  together: { src: togetherColor, tinted: false },
  xiaomi: { src: xiaomimimo, tinted: true },
  opencode: { src: opencode, tinted: true },
  ollama: { src: ollama, tinted: true },
  "ant-ling": { src: antgroupColor, tinted: false },
  baseten: { src: baseten, tinted: true },
};

function familyOf(id: string): string {
  const key = id.trim().toLowerCase();
  if (!key) return key;
  if (ALIASES[key]) return ALIASES[key]!;
  if (NAMES[key] || ICONS[key]) return key;
  if (key.startsWith("qwen")) return "qwen";
  if (key.startsWith("zai")) return "zhipu";
  if (key.startsWith("kimi") || key.startsWith("moonshot")) return "kimi";
  if (key.startsWith("minimax")) return "minimax";
  if (key.startsWith("xiaomi")) return "xiaomi";
  if (key.startsWith("cloudflare-workers")) return "workersai";
  if (key.startsWith("cloudflare")) return "cloudflare";
  if (key.startsWith("vercel")) return "vercel";
  if (key.startsWith("github")) return "copilot";
  if (key.startsWith("google")) return "google";
  return key;
}

export function vendorDisplayName(id: string): string {
  const key = id.trim();
  if (!key) return key;
  return NAMES[familyOf(key)] ?? key;
}

export function vendorIcon(id: string): VendorIcon | undefined {
  return ICONS[familyOf(id)];
}
