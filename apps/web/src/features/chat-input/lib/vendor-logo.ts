/** 供应商品牌展示：id → 显示名 / 矢量标记。未知供应商回退到原 id。 */

export interface VendorPath {
  d: string;
  fill?: string;
  fillRule?: "evenodd" | "nonzero";
}

export interface VendorGlyph {
  viewBox: string;
  paths: VendorPath[];
}

const NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  xai: "xAI",
  google: "Google",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  "github-copilot": "GitHub Copilot",
  mistral: "Mistral",
  groq: "Groq",
  amazon: "Amazon Bedrock",
  qwen: "Qwen",
  zai: "Zhipu AI",
  kimi: "Kimi",
  minimax: "MiniMax",
  huggingface: "Hugging Face",
  nvidia: "NVIDIA",
  vercel: "Vercel",
  cerebras: "Cerebras",
  cloudflare: "Cloudflare",
  fireworks: "Fireworks",
  together: "Together",
  xiaomi: "Xiaomi",
  opencode: "OpenCode",
  radius: "Radius",
  ollama: "Ollama",
  "ant-ling": "Ant Ling",
};

const ALIASES: Record<string, string> = {
  "azure-openai-responses": "openai",
  "openai-codex": "openai",
  copilot: "github-copilot",
  gemini: "google",
  "google-gemini-cli": "google",
  "google-vertex": "google",
  "amazon-bedrock": "amazon",
  bedrock: "amazon",
  moonshot: "kimi",
  "kimi-coding": "kimi",
  "vercel-ai-gateway": "vercel",
  zhipu: "zai",
};

function familyOf(id: string): string {
  const key = id.trim().toLowerCase();
  if (!key) return key;
  if (ALIASES[key]) return ALIASES[key]!;
  if (NAMES[key]) return key;
  if (key.startsWith("qwen")) return "qwen";
  if (key.startsWith("zai")) return "zai";
  if (key.startsWith("kimi") || key.startsWith("moonshot")) return "kimi";
  if (key.startsWith("minimax")) return "minimax";
  if (key.startsWith("xiaomi")) return "xiaomi";
  if (key.startsWith("opencode")) return "opencode";
  if (key.startsWith("cloudflare")) return "cloudflare";
  if (key.startsWith("vercel")) return "vercel";
  if (key.startsWith("github")) return "github-copilot";
  return key;
}

export function vendorFamily(id: string): string {
  return familyOf(id);
}

export function vendorDisplayName(id: string): string {
  const key = id.trim();
  if (!key) return key;
  return NAMES[key] ?? NAMES[familyOf(key)] ?? key;
}

const GLYPHS: Record<string, VendorGlyph> = {
  openai: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.181a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.096 5.98 5.98 0 0 0 .511 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.142-.08 4.778-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.582a4.504 4.504 0 0 1-4.494 4.494zm-9.661-4.125a4.47 4.47 0 0 1-.534-3.014l.141.085 4.783 2.758a.771.771 0 0 0 .78 0l5.843-3.368v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.499 4.499 0 0 1-6.141-1.646zM2.34 7.895a4.485 4.485 0 0 1 2.366-1.972l4.778 2.758a.795.795 0 0 0 .393.681v6.737l-2.02-1.168a.071.071 0 0 1-.038-.052v-5.582A4.504 4.504 0 0 1 11.82 5.6a4.46 4.46 0 0 1 2.876 1.044l-.141.08-4.778 2.759a.794.794 0 0 0-.393.68v6.737l-2.02-1.168a.071.071 0 0 1-.038-.052V10.16A4.504 4.504 0 0 1 2.34 7.896zm15.032 2.268-5.843-3.367 2.02-1.166a.775.775 0 0 1 .78 0l4.779 2.758a4.498 4.498 0 0 1 .134 7.677l-.142-.085-4.783-2.758a.771.771 0 0 0-.78 0l-5.843 3.368v-2.332a.08.08 0 0 1 .033-.062z",
      },
    ],
  },
  anthropic: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 2.4 4.2 21.6h3.5l1.5-3.8h5.6l1.5 3.8h3.5L12 2.4zm-1.15 7.3 2.15 5.3H8.7z",
      },
    ],
  },
  google: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z",
        fill: "#4285F4",
      },
      {
        d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z",
        fill: "#34A853",
      },
      {
        d: "M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.72.12-1.43.34-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93z",
        fill: "#FBBC05",
      },
      {
        d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
        fill: "#EA4335",
      },
    ],
  },
  xai: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M3.4 3.2 10.6 12 3.4 20.8h4.3L12 14.7l4.3 6.1h4.3L13.4 12l7.2-8.8h-4.3L12 9.3 7.7 3.2z",
      },
    ],
  },
  openrouter: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M3 4.5A1.5 1.5 0 0 1 4.5 3h6A1.5 1.5 0 0 1 12 4.5v6A1.5 1.5 0 0 1 10.5 12h-6A1.5 1.5 0 0 1 3 10.5zm9 9A1.5 1.5 0 0 1 13.5 12h6A1.5 1.5 0 0 1 21 13.5v6A1.5 1.5 0 0 1 19.5 21h-6A1.5 1.5 0 0 1 12 19.5zM8.4 13.8 13.8 8.4l1.8 1.8-5.4 5.4z",
      },
    ],
  },
  deepseek: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 2c5.523 0 10 4.03 10 9 0 3.314-1.79 6.24-4.5 7.94V22l-3.2-2.13A10.3 10.3 0 0 1 12 20C6.477 20 2 15.97 2 11S6.477 2 12 2zm-1.1 5.2-.9 3.4H6.7l3.1 2.25-.95 3.4L12 14.2l3.15 2.05-.95-3.4 3.1-2.25h-3.3l-.9-3.4L12 8.4z",
      },
    ],
  },
  "github-copilot": {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
      },
    ],
  },
  mistral: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M3 4h4v4H3zm5 4h4v4H8zm5-4h4v4h-4zm5 8h3v8h-3zM3 12h4v8H3zm10 0h4v8h-4z",
        fill: "#FA520F",
      },
    ],
  },
  groq: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 2a10 10 0 1 0 9.95 11h-2.02A8 8 0 1 1 12 4v4l6-4-6-4z",
      },
    ],
  },
  amazon: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M16.5 14.3c-2.3 1.7-5.6 2.6-8.5 2.6-4 0-7.6-1.5-10.3-3.9-.2-.2 0-.4.3-.3 2.9 1.6 6.5 2.6 10.2 2.6 2.5 0 5.3-.5 7.8-1.6.4-.2.7.3.5.6zm1.2-1.4c-.3-.4-1.9-.2-2.6-.1-.2 0-.3-.2-.1-.3 1.1-.8 3-.6 3.2-.3.2.3-.1 2.3-1.1 3.2-.2.1-.3 0-.2-.2.3-.7.8-2.3.8-2.3zM13.2 3.2 8.9 13.5h1.8l.9-2.3h4.5l.2.6.2.5h1.9L13.8 3.2h-.6zm.3 2.2 1.6 4.3h-3.3z",
      },
    ],
  },
  qwen: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 2 3.5 7v10L12 22l8.5-5V7zm0 3.2 5.3 3.1v6.4L12 17.8l-5.3-3.1V8.3z",
        fill: "#6A4CFF",
      },
    ],
  },
  zai: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M4 6h16v3.2L10.8 14H20V18H4v-3.2L13.2 10H4z",
        fill: "#1A5CFF",
      },
    ],
  },
  kimi: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M4 4h4.5l5 6.5L18.8 4H22l-7.2 9.2L22 20h-4.5l-5.2-6.7L7.2 20H4l7.3-9.3z",
      },
    ],
  },
  minimax: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M3 19V5h3.2l5.8 8.4V5H15v14h-3.2L6 10.6V19zm14.2-8.2c0-3.3 1.7-5.3 4.8-5.3v3c-1.4 0-2 .8-2 2.2V19h-2.8z",
      },
    ],
  },
  huggingface: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 2a8 8 0 0 1 8 8c0 5.25-8 12-8 12S4 15.25 4 10a8 8 0 0 1 8-8zm-3.2 7.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm6.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM8.8 13.4c.7 1.2 1.9 2 3.2 2s2.5-.8 3.2-2",
      },
    ],
  },
  nvidia: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 3c5.5 2.6 8 6.6 8 11.2 0 2.3-.8 4.3-2.2 5.8C20.2 17.4 22 14.3 22 10.6 22 6.2 18.8 3 12 3zm0 0C5.2 3 2 6.2 2 10.6c0 3.7 1.8 6.8 4.2 9.4C4.8 18.5 4 16.5 4 14.2 4 9.6 6.5 5.6 12 3zm0 4.2c-3.2 1.7-4.6 4-4.6 6.8 0 2 1 3.7 2.6 4.8C8.4 17.4 7.6 15.8 7.6 14c0-3 1.8-5.5 4.4-6.8z",
        fill: "#76B900",
      },
    ],
  },
  vercel: {
    viewBox: "0 0 24 24",
    paths: [{ d: "M12 3 22 21H2z" }],
  },
  cerebras: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M7 4h10l5 8-5 8H7L2 12zm2.2 3.2L5.8 12l3.4 4.8h7.6L20.2 12 16.8 7.2z",
      },
    ],
  },
  cloudflare: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M16.5 10.2c.3-2.6-1.6-4.9-4.3-5.2-1.8-.2-3.5.6-4.4 2.1C6.2 7 4.5 8.4 4.5 10.6c0 .2 0 .4.05.6H4.3C2.5 11.2 1 12.7 1 14.6 1 16.6 2.6 18.2 4.6 18.2h14c2.4 0 4.4-2 4.4-4.4 0-2.3-1.8-4.2-4.1-4.4z",
        fill: "#F38020",
      },
    ],
  },
  fireworks: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 2 9.2 8.8 2 9.5l5.6 4.7L5.8 21 12 17.3 18.2 21l-1.8-6.8L22 9.5l-7.2-.7z",
        fill: "#7C3AED",
      },
    ],
  },
  together: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M7 4h10v3.2H13.6V20h-3.2V7.2H7z",
      },
    ],
  },
  xiaomi: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M5 7h4.2v10H5zm5.4 0H15c2.8 0 4.6 1.7 4.6 4.6S17.8 16.2 15 16.2h-4.6zm4.4 3.2h-.8v3.6h.8c1.1 0 1.8-.7 1.8-1.8s-.7-1.8-1.8-1.8z",
        fill: "#FF6900",
      },
    ],
  },
  opencode: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M8.5 4 3 12l5.5 8h3.2L6.2 12 11.7 4zm7 0L21 12l-5.5 8h-3.2L17.8 12 12.3 4z",
      },
    ],
  },
  radius: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
      },
    ],
  },
  ollama: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 3c4.4 0 8 3.1 8 7.4 0 2.7-1.5 5-3.8 6.3L17.5 21h-3.2l-.8-3.1h-3l-.8 3.1H6.5l1.3-4.3C5.5 15.4 4 13.1 4 10.4 4 6.1 7.6 3 12 3zm-3.2 6.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm6.4 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z",
      },
    ],
  },
  "ant-ling": {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 2 4 6.5v11L12 22l8-4.5v-11zm0 4.2 4.6 2.6v5.4L12 16.8 7.4 14.2V8.8z",
      },
    ],
  },
};

export function vendorGlyph(id: string): VendorGlyph | undefined {
  const family = familyOf(id);
  return GLYPHS[family];
}
