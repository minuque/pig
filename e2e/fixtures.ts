import { test as base, expect } from "@playwright/test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Gateway from "../packages/gateway/src/index.js";
import type { DirectoryPort } from "../packages/gateway/src/directory.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(root, "apps/web/dist");
const BOOTSTRAP_SECRET = "e2e-bootstrap";

/** 与 web canonicalizeWorkspacePath 对齐，供 localStorage 种子。 */
export function canonicalizeWorkspacePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[A-Z]:/.test(normalized)
    ? normalized[0]!.toLowerCase() + normalized.slice(1)
    : normalized;
}

export interface E2eGateway {
  readonly origin: string;
  readonly bootstrapUrl: string;
  readonly workspaceDir: string;
  readonly workspaceId: string;
}

type TestFixtures = { gateway: E2eGateway };

export const test = base.extend<TestFixtures>({
  gateway: [
    async ({}, use) => {
      const temp = await mkdtemp(join(tmpdir(), "pig-e2e-"));
      const workspaceDir = join(temp, "workspace");
      const sessionDir = join(temp, "sessions");
      await mkdir(workspaceDir);
      await mkdir(sessionDir);
      await writeFile(join(workspaceDir, ".keep"), "");
      const workspaceId = canonicalizeWorkspacePath(workspaceDir);
      const platformPort: DirectoryPort = {
        async selectDirectory() {
          return workspaceDir;
        },
        async validateDirectory(path) {
          return path;
        },
      };
      const gateway = new Gateway({
        bootstrapSecret: BOOTSTRAP_SECRET,
        bootstrapTtlMs: Number.POSITIVE_INFINITY,
        webRoot,
        sessionDir,
        cwd: workspaceDir,
        platformPort,
        port: 0,
      });
      const port = await gateway.start();
      const origin = `http://127.0.0.1:${port}`;
      try {
        await use({
          origin,
          bootstrapUrl: `${origin}/#bootstrap=${encodeURIComponent(BOOTSTRAP_SECRET)}`,
          workspaceDir,
          workspaceId,
        });
      } finally {
        await gateway.stop();
        await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    },
    { scope: "test" },
  ],
});

export { expect };
