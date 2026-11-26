import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent"

export const ASK_TOOL = "ask_user_question"
const option = {
  type: "object",
  properties: {
    label: {
      type: "string",
      maxLength: 60,
      description:
        "MAX 60 CHARACTERS. The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.",
    },
    description: {
      type: "string",
      description:
        "Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.",
    },
  },
  required: ["label", "description"],
}
const question = {
  type: "object",
  properties: {
    question: {
      type: "string",
      description:
        'The complete question to ask the user. Should be clear, specific, and end with a question mark. If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"',
    },
    header: {
      type: "string",
      maxLength: 16,
      description:
        'MAX 16 CHARACTERS. Very short chip/tag shown next to the question. Examples: "Auth method", "Library", "Approach".',
    },
    options: {
      type: "array",
      items: option,
      minItems: 2,
      maxItems: 4,
      description:
        "The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). Do NOT author an 'Other' option; the user can always answer in their own words unless allowCustom is false.",
    },
    multiSelect: {
      type: "boolean",
      description:
        "Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.",
    },
    allowCustom: {
      type: "boolean",
      description:
        "Whether the user may answer in their own words instead of picking an option. Defaults to true.",
    },
  },
  required: ["question", "header", "options"],
}

export default function ask(pi: ExtensionAPI) {
  pi.registerTool({
    name: ASK_TOOL,
    label: "Ask user question",
    description:
      "Ask the user 1-4 structured questions and end this turn. The user's answers arrive as the next user message.",
    promptSnippet: "Ask the user up to 4 structured questions when requirements are ambiguous",
    promptGuidelines: [
      "Call ask_user_question alone: do not call other tools in the same message.",
      "After calling ask_user_question, stop. Do not assume or invent the answer.",
    ],
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: question,
          minItems: 1,
          maxItems: 4,
          description: "Questions to ask the user (1-4 questions)",
        },
      },
      required: ["questions"],
    } as never,
    exposure: "model-only",
    executionMode: "sequential",
    execute: async (_id, params) => {
      const count = (params as { questions: unknown[] }).questions.length
      return {
        content: [
          {
            type: "text",
            text: `Asked the user ${count} question(s). This turn ends here; their answers arrive as the next user message.`,
          },
        ],
        details: undefined,
        terminate: true,
      }
    },
  } as ToolDefinition)
}
