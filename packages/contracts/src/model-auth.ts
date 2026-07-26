import { z } from "zod";
import { InstantSchema, RevisionSchema } from "./common.js";
import {
  AuthFlowIdSchema,
  CommandIdSchema,
  ModelIdSchema,
  ProviderIdSchema,
} from "./ids.js";
import { ThinkingLevelSchema } from "./run.js";

export const ModelSchema = z.object({
  modelId: ModelIdSchema,
  providerId: ProviderIdSchema,
  name: z.string().min(1).max(160),
  available: z.boolean(),
  thinkingLevels: z.array(ThinkingLevelSchema),
});
export const ProviderAuthStatusSchema = z.object({
  providerId: ProviderIdSchema,
  revision: RevisionSchema,
  state: z.enum(["ready", "required", "unavailable"]),
  methods: z.array(z.enum(["apiKey", "authFlow"])),
});
const AuthInteractionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("openUrl"),
    url: z.string().url(),
    label: z.string().max(120),
  }),
  z.object({
    kind: z.literal("deviceCode"),
    verificationUrl: z.string().url(),
    userCode: z.string().min(1).max(128),
    expiresAt: InstantSchema,
  }),
  z.object({
    kind: z.literal("prompt"),
    promptId: z.string().min(1).max(128),
    label: z.string().max(200),
    sensitive: z.boolean(),
  }),
  z.object({
    kind: z.literal("select"),
    promptId: z.string().min(1).max(128),
    label: z.string().max(200),
    options: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .min(1)
      .max(50),
  }),
]);
export const AuthFlowSchema = z.object({
  flowId: AuthFlowIdSchema,
  providerId: ProviderIdSchema,
  revision: RevisionSchema,
  state: z.enum([
    "pending",
    "succeeded",
    "failed",
    "cancelled",
    "expired",
    "interrupted",
  ]),
  interaction: AuthInteractionSchema.optional(),
  expiresAt: InstantSchema,
});
export const SetApiKeySchema = z.strictObject({
  commandId: CommandIdSchema,
  apiKey: z.string().min(1).max(16_384),
});
export const CreateAuthFlowSchema = z.strictObject({
  commandId: CommandIdSchema,
});
export const RespondAuthFlowSchema = z.strictObject({
  commandId: CommandIdSchema,
  promptId: z.string().min(1).max(128),
  response: z.string().min(1).max(16_384),
});

export type Model = z.infer<typeof ModelSchema>;
export type ProviderAuthStatus = z.infer<typeof ProviderAuthStatusSchema>;
export type AuthFlow = z.infer<typeof AuthFlowSchema>;
