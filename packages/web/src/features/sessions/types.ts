export interface SessionDto {
  id: string;
  workspaceId: string;
  name?: string;
  status: "available" | "unavailable";
  updatedAt: string;
}
