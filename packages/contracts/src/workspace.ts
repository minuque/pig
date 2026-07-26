import { z } from "zod";
import { InstantSchema, RevisionSchema } from "./common.js";
import { CommandIdSchema, PreviewIdSchema, WorkspaceIdSchema } from "./ids.js";

export const WorkspaceSummarySchema = z.object({
  workspaceId: WorkspaceIdSchema,
  name: z.string().min(1).max(120),
  revision: RevisionSchema,
  updatedAt: InstantSchema,
});
export const WorkspaceDetailSchema = WorkspaceSummarySchema.extend({
  canonicalRoot: z.string().min(1).max(4096),
  grantNotice: z.literal("Gateway access only; not a filesystem sandbox"),
});
export const WorkspaceRegistrationPreviewSchema = z.object({
  previewId: PreviewIdSchema,
  canonicalRoot: z.string().min(1).max(4096),
  expiresAt: InstantSchema,
  grantNotice: z.literal("Gateway access only; not a filesystem sandbox"),
});
export const CreateWorkspacePreviewSchema = z.strictObject({
  commandId: CommandIdSchema,
  candidatePath: z.string().min(1).max(4096),
});
export const CreateWorkspaceSchema = z.strictObject({
  commandId: CommandIdSchema,
  previewId: PreviewIdSchema,
  name: z.string().min(1).max(120),
});
export const UpdateWorkspaceSchema = z.strictObject({
  commandId: CommandIdSchema,
  expectedRevision: RevisionSchema,
  name: z.string().min(1).max(120),
});

export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;
export type WorkspaceDetail = z.infer<typeof WorkspaceDetailSchema>;
export type WorkspaceRegistrationPreview = z.infer<
  typeof WorkspaceRegistrationPreviewSchema
>;
