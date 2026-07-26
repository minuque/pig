import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, expect } from "@playwright/test";

export interface PackagedGateway {
  readonly bootstrapUrl: string;
  readonly dataDir: string;
  readonly workspaceDir: string;
  readonly tarball: string;
  restart(): Promise<void>;
}

type TestFixtures = { gateway: PackagedGateway };

async function startDeterministicModelServer(): Promise<{
  origin: string;
  close(): Promise<void>;
}> {
  const server = createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
      response.writeHead(404).end();
      return;
    }
    request.resume();
    request.once("end", () => {
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      const id = "chatcmpl_release";
      const created = Math.floor(Date.now() / 1000);
      const chunk = (delta: Record<string, string>, finishReason: string | null) =>
        `data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          created,
          model: "acceptance-model",
          choices: [{ index: 0, delta, finish_reason: finishReason, logprobs: null }],
        })}\n\n`;
      response.write(chunk({ role: "assistant" }, null));
      const deltas = ["Release ", "stream ", "complete.\n\n```ts\nconst answer = 42;\n```\n"];
      let index = 0;
      const writeNext = () => {
        const text = deltas[index++];
        if (text !== undefined) {
          response.write(chunk({ content: text }, null));
          setTimeout(writeNext, 250);
          return;
        }
        response.write(chunk({}, "stop"));
        response.end("data: [DONE]\n\n");
      };
      writeNext();
    });
  });
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Deterministic model server did not bind a TCP port");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function waitForExit(child: ChildProcess, timeoutMs = 15_000): Promise<void> {
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
      if (!project || !tarball) throw new Error("Acceptance packed install was not prepared");
      const temp = await mkdtemp(join(tmpdir(), `npng-browser-${testInfo.workerIndex}-`));
      const dataDir = join(temp, "data-root");
      const workspaceDir = join(temp, "workspace");
      const piDir = join(temp, "pi-agent");
      await Promise.all([mkdir(dataDir), mkdir(workspaceDir), mkdir(piDir)]);
      const modelServer = await startDeterministicModelServer();
      await writeFile(
        join(piDir, "models.json"),
        JSON.stringify({
          providers: {
            "release-test": {
              baseUrl: `${modelServer.origin}/v1`,
              api: "openai-completions",
              apiKey: "release-test-key",
              compat: {
                supportsDeveloperRole: false,
                supportsReasoningEffort: false,
              },
              models: [
                {
                  id: "acceptance-model",
                  name: "Acceptance model",
                  reasoning: false,
                  input: ["text"],
                  contextWindow: 128_000,
                  maxTokens: 4_096,
                  cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                },
              ],
            },
          },
        }),
      );
      const cli = join(project, "node_modules", "no-pi-no-gang", "dist", "cli.js");
      let child: ChildProcess | null = null;
      let currentUrl = "";

      async function start(): Promise<void> {
        child = spawn(process.execPath, [cli, "--no-open", "--data-dir", dataDir, workspaceDir], {
          cwd: project,
          env: {
            ...process.env,
            PI_CODING_AGENT_DIR: piDir,
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        currentUrl = await new Promise<string>((resolve, reject) => {
          let output = "";
          const timeout = setTimeout(
            () => reject(new Error(`Gateway startup timed out\n${output}`)),
            20_000,
          );
          const onData = (chunk: Buffer) => {
            output += chunk.toString();
            const match = /listening at (http:\/\/127\.0\.0\.1:\d+\/#bootstrap=[^\s]+)/.exec(
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
            reject(new Error(`Gateway exited during startup (${code})\n${output}`));
          });
        });
      }

      try {
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
        await use(gateway);
      } finally {
        await stop(child);
        await modelServer.close();
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
