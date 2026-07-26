import { test as base, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface PackagedGateway {
  readonly bootstrapUrl: string;
  readonly dataDir: string;
  readonly workspaceDir: string;
  readonly tarball: string;
  restart(): Promise<void>;
}

type TestFixtures = { gateway: PackagedGateway };

async function waitForExit(
  child: ChildProcess,
  timeoutMs = 15_000,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Gateway did not stop within 15 seconds")),
      timeoutMs,
    );
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function stop(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  try {
    await waitForExit(child);
  } catch (error) {
    child.kill("SIGKILL");
    await waitForExit(child, 2_000).catch(() => undefined);
    throw error;
  }
}

export const test = base.extend<TestFixtures>({
  gateway: [
    async ({}, use, testInfo) => {
      const project = process.env.NPNG_ACCEPTANCE_INSTALL;
      const tarball = process.env.NPNG_ACCEPTANCE_TARBALL;
      if (!project || !tarball)
        throw new Error("Acceptance packed install was not prepared");
      const temp = await mkdtemp(
        join(tmpdir(), `npng-browser-${testInfo.workerIndex}-`),
      );
      const dataDir = join(temp, "data-root");
      const workspaceDir = join(temp, "workspace");
      const piDir = join(temp, "pi-agent");
      await Promise.all([mkdir(dataDir), mkdir(workspaceDir), mkdir(piDir)]);
      const cli = join(
        project,
        "node_modules",
        "no-pi-no-gang",
        "dist",
        "cli.js",
      );
      let child: ChildProcess | null = null;
      let currentUrl = "";

      async function start(): Promise<void> {
        child = spawn(
          process.execPath,
          [cli, "--no-open", "--data-dir", dataDir, workspaceDir],
          {
            cwd: project,
            env: {
              ...process.env,
              PI_CODING_AGENT_DIR: piDir,
              NPNG_CAPABILITY_ADAPTER: "deterministic",
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        currentUrl = await new Promise<string>((resolve, reject) => {
          let output = "";
          const timeout = setTimeout(
            () => reject(new Error(`Gateway startup timed out\n${output}`)),
            20_000,
          );
          const onData = (chunk: Buffer) => {
            output += chunk.toString();
            const match =
              /listening at (http:\/\/127\.0\.0\.1:\d+\/#bootstrap=[^\s]+)/.exec(
                output,
              );
            if (match) {
              clearTimeout(timeout);
              resolve(match[1]!);
            }
          };
          child!.stdout!.on("data", onData);
          child!.stderr!.on("data", onData);
          child!.once("exit", (code) => {
            clearTimeout(timeout);
            reject(
              new Error(`Gateway exited during startup (${code})\n${output}`),
            );
          });
        });
      }

      await start();
      const gateway: PackagedGateway = {
        get bootstrapUrl() {
          return currentUrl;
        },
        dataDir,
        workspaceDir,
        tarball,
        async restart() {
          await stop(child);
          await start();
        },
      };
      try {
        await use(gateway);
      } finally {
        await stop(child);
        await rm(temp, {
          recursive: true,
          force: true,
          maxRetries: process.platform === "win32" ? 5 : 0,
          retryDelay: 100,
        });
      }
    },
    { scope: "test" },
  ],
});

export { expect };
