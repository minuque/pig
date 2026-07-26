#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { capabilityAdapterFromEnvironment } from "./capabilities.js";
import { listBackups, openDatabase, restoreBackup } from "./db/migrations.js";
import { Store } from "./db/store.js";
import { Health } from "./diagnostics/health.js";
import { DiagnosticSink } from "./diagnostics/sink.js";
import { acquireLock, readMarkerStatus, writeMarker } from "./platform/lock.js";
import { ensureRoots, resolveDataRoots } from "./platform/paths.js";
import { createHttpGateway } from "./server.js";

const version = "0.1.0";
function help() {
  console.log(
    "no-pi-no-gang [workspace-path] [--no-open] [--data-dir <absolute-path>]\nno-pi-no-gang backups list [--data-dir <path>]\nno-pi-no-gang backups restore <backup-id> --confirm [--data-dir <path>]",
  );
}
function args(argv: string[]) {
  let dataDir: string | undefined,
    noOpen = false,
    workspace = process.cwd(),
    maintenance: string | undefined,
    backupId: string | undefined,
    confirm = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") {
      help();
      process.exit(0);
    }
    if (a === "--version" || a === "-v") {
      console.log(version);
      process.exit(0);
    }
    if (a === "--no-open") {
      noOpen = true;
      continue;
    }
    if (a === "--data-dir") {
      dataDir = argv[++i];
      continue;
    }
    if (a === "backups") {
      maintenance = argv[++i];
      continue;
    }
    if (a === "--confirm") {
      confirm = true;
      continue;
    }
    if (maintenance === "restore" && !backupId) {
      backupId = a;
      continue;
    }
    if (!a.startsWith("-")) workspace = a;
    else throw new Error("request.validation_failed");
  }
  return { dataDir, noOpen, workspace, maintenance, backupId, confirm };
}
function startHealthServer(health: Health): Promise<Server> {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", "no-store");
    if (request.method === "GET" && request.url === "/api/v1/health/live") {
      response.statusCode = 200;
      response.end(JSON.stringify({ status: "live" }));
      return;
    }
    if (request.method === "GET" && request.url === "/api/v1/health/ready") {
      const status = health.get();
      response.statusCode = status === "ready" ? 200 : 503;
      response.end(JSON.stringify({ status }));
      return;
    }
    response.statusCode = 503;
    response.end(JSON.stringify({ status: health.get() }));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

export function isSupportedNodeVersion(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return (major === 22 && minor >= 19) || major === 24;
}

async function main() {
  if (!isSupportedNodeVersion(process.versions.node)) {
    throw new Error("node.unsupported: requires >=22.19.0 <23 or >=24.0.0 <25");
  }
  const a = args(process.argv.slice(2)),
    roots = resolveDataRoots(a.dataDir);
  await ensureRoots(roots);
  const release = await acquireLock(roots);
  if (a.maintenance) {
    try {
      if (a.maintenance === "list") {
        console.log(JSON.stringify(await listBackups(roots), null, 2));
        return;
      }
      if (a.maintenance === "restore" && a.backupId && a.confirm) {
        await restoreBackup(roots, a.backupId);
        console.log("Restored backup. Run the recorded compatible version.");
        return;
      }
      throw new Error("request.validation_failed");
    } finally {
      await release();
    }
  }
  const markerStatus = await readMarkerStatus(roots.marker);
  if (markerStatus === "running") {
    await new DiagnosticSink(roots.logs).emit({
      code: "process.previous_unclean",
      severity: "warn",
    });
  } else if (markerStatus === "invalid") {
    await new DiagnosticSink(roots.logs).emit({
      code: "process.marker_invalid",
      severity: "warn",
    });
  }
  await writeMarker(roots.marker, "running", crypto.randomUUID());
  const health = new Health();
  const startupServer = await startHealthServer(health);
  health.set("migrating");
  const runtimeRoot = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
  let db: Awaited<ReturnType<typeof openDatabase>>;
  try {
    db = await openDatabase(roots, join(runtimeRoot, "migrations"));
  } catch (error) {
    await new Promise<void>((resolve) => startupServer.close(() => resolve()));
    await release();
    throw error;
  }
  health.set("reconciling");
  const capabilityAdapter = capabilityAdapterFromEnvironment();
  let gateway: Awaited<ReturnType<typeof createHttpGateway>>;
  try {
    gateway = await createHttpGateway(
      new Store(db),
      roots,
      a.workspace,
      join(runtimeRoot, "public"),
      {
        ...(capabilityAdapter ? { capabilities: capabilityAdapter } : {}),
        server: startupServer,
        health,
      },
    );
  } catch (error) {
    await new Promise<void>((resolve) => startupServer.close(() => resolve()));
    db.close();
    await release();
    throw error;
  }
  console.log(`no-pi-no-gang listening at ${gateway.bootstrapUrl}`);
  if (!a.noOpen) {
    try {
      const { exec } = await import("node:child_process");
      exec(
        process.platform === "win32"
          ? `start "" "${gateway.bootstrapUrl}"`
          : process.platform === "darwin"
            ? `open "${gateway.bootstrapUrl}"`
            : `xdg-open "${gateway.bootstrapUrl}"`,
      );
    } catch {}
  }
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    const forceExit = setTimeout(() => process.exit(1), 15_000);
    const drained = await Promise.race([
      gateway.close().then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 10_000)),
    ]);
    if (!drained) return;
    await writeMarker(roots.marker, "clean", gateway.epoch);
    await release();
    clearTimeout(forceExit);
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "server.internal");
    process.exitCode = 1;
  });
}
