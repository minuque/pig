import { z } from "zod";
import { InstantSchema } from "./common.js";
import { EntryIdSchema, ModelIdSchema, RunIdSchema } from "./ids.js";

const base = z.object({ entryId: EntryIdSchema, createdAt: InstantSchema });
export const TranscriptItemSchema = z.discriminatedUnion("kind", [
  base.extend({
    kind: z.literal("message"),
    role: z.enum(["user", "assistant"]),
    text: z.string(),
  }),
  base.extend({
    kind: z.literal("toolCall"),
    toolName: z.string().min(1).max(120),
    callId: z.string().min(1).max(128),
    summary: z.string().max(500).optional(),
  }),
  base.extend({
    kind: z.literal("toolResult"),
    callId: z.string().min(1).max(128),
    status: z.enum(["success", "error"]),
    text: z.string(),
  }),
  base.extend({ kind: z.literal("compaction"), summary: z.string() }),
  base.extend({ kind: z.literal("modelChange"), modelId: ModelIdSchema }),
  base.extend({
    kind: z.literal("notice"),
    level: z.enum(["info", "warning", "error"]),
    text: z.string(),
  }),
  base.extend({
    kind: z.literal("unsupported"),
    sourceType: z.string().min(1).max(80),
    safeLabel: z.string().max(160).optional(),
  }),
]);

export const PartialRunOutputSchema = z.object({
  runId: RunIdSchema,
  text: z.string(),
  thinking: z.string(),
  tools: z.array(
    z.object({
      callId: z.string(),
      status: z.string(),
      summary: z.string().optional(),
    }),
  ),
});
export type TranscriptItem = z.infer<typeof TranscriptItemSchema>;
export type PartialRunOutput = z.infer<typeof PartialRunOutputSchema>;
