import { z } from "zod";
import { ContractRevisionSchema } from "./common.js";
import { EventCursorSchema, PrincipalIdSchema } from "./ids.js";
import { ModelSchema, ProviderAuthStatusSchema } from "./model-auth.js";
import { RunSummarySchema } from "./run.js";

export const CapabilitiesSchema = z.object({
  maxPageSize: z.number().int().min(1).max(100),
  defaultPageSize: z.number().int().min(1).max(100),
  maxQueuedRunsPerSession: z.literal(32),
  maxActiveRuns: z.number().int().positive(),
  features: z.record(z.string(), z.boolean()),
});
export const BootstrapSchema = z.object({
  gatewayBuildId: z.string().min(1).max(128),
  principal: z.object({
    principalId: PrincipalIdSchema,
    displayName: z.string().min(1).max(120),
  }),
  contractRevision: ContractRevisionSchema,
  minClientRevision: ContractRevisionSchema,
  csrfToken: z.string().min(32).max(512),
  capabilities: CapabilitiesSchema,
  models: z.array(ModelSchema),
  providerAuth: z.array(ProviderAuthStatusSchema),
  nonterminalRuns: z.array(RunSummarySchema),
  capturedEventCursor: EventCursorSchema,
  proposedWorkspacePath: z.string().max(4096).optional(),
});
export const BootstrapExchangeSchema = z.strictObject({
  secret: z.string().min(32).max(512),
});
export const BootstrapExchangeResultSchema = z.object({
  csrfToken: z.string().min(32).max(512),
});
export const LiveHealthSchema = z.object({ status: z.literal("live") });
export const ReadyHealthSchema = z.object({
  status: z.enum([
    "ready",
    "starting",
    "migrating",
    "reconciling",
    "shutting_down",
    "unavailable",
  ]),
});

export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export type Bootstrap = z.infer<typeof BootstrapSchema>;
