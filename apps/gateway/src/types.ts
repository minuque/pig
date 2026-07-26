import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
export interface DataRoots {
  base: string;
  data: string;
  state: string;
  cache: string;
  logs: string;
  database: string;
  lock: string;
  marker: string;
  backups: string;
}
export interface GatewayOptions {
  dataDir?: string;
  proposedWorkspacePath?: string;
  noOpen?: boolean;
  publicDir?: string;
  migrationDir?: string;
}
export type HealthState =
  | "starting"
  | "migrating"
  | "reconciling"
  | "ready"
  | "shutting_down"
  | "unavailable";
export interface GatewayHandle {
  origin: string;
  port: number;
  epoch: string;
  bootstrapUrl: string;
  close(): Promise<void>;
  db: DatabaseSync;
  server: Server;
}
export interface Row {
  [key: string]: unknown;
}
