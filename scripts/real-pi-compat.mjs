import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = resolve(import.meta.dirname, "..");
const support = JSON.parse(
  await readFile(join(root, "release-support.json"), "utf8"),
);
const candidate = support.pi.candidate;
const previous = support.pi.previous;
assert.equal(
  candidate,
  "0.82.1",
  "candidate Pi must remain fixed for this release",
);
assert.equal(typeof previous, "string");
assert.notEqual(previous, candidate);
const installed = JSON.parse(
  await readFile(
    join(
      root,
      "node_modules",
      "@earendil-works",
      "pi-coding-agent",
      "package.json",
    ),
    "utf8",
  ),
);
assert.equal(
  installed.version,
  candidate,
  "installed Pi does not match release-support.json",
);

const temp = await mkdtemp(join(tmpdir(), "npng-real-pi-"));
const agentDir = join(temp, "agent");
const sessionsDir = join(agentDir, "sessions");
const workspace = join(temp, "workspace");
const dataDir = join(temp, "gateway-data");
const barrier = join(root, ".scratch", "rollback-barrier.json");
await Promise.all([
  mkdir(sessionsDir, { recursive: true }),
  mkdir(workspace),
  mkdir(dataDir),
]);
process.env.PI_CODING_AGENT_DIR = agentDir;

function commandId() {
  return crypto.randomUUID().replaceAll("-", "_");
}

async function startGateway() {
  const cli =
    process.env.NPNG_GATEWAY_CLI ??
    join(root, "apps", "gateway", "dist", "cli.js");
  const child = spawn(
    process.execPath,
    [cli, "--no-open", "--data-dir", dataDir, workspace],
    {
      cwd: root,
      env: { ...process.env, NPNG_CAPABILITY_ADAPTER: "deterministic" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const bootstrapUrl = await new Promise((resolveUrl, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error(`Gateway startup timed out\n${output}`)),
      20_000,
    );
    const data = (chunk) => {
      output += chunk.toString();
      const match =
        /listening at (http:\/\/127\.0\.0\.1:\d+\/#bootstrap=[^\s]+)/.exec(
          output,
        );
      if (match) {
        clearTimeout(timer);
        resolveUrl(match[1]);
      }
    };
    child.stdout.on("data", data);
    child.stderr.on("data", data);
    child.once("exit", (code) =>
      reject(new Error(`Gateway startup failed (${code})\n${output}`)),
    );
  });
  return { child, bootstrapUrl };
}

async function stopGateway(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolveExit, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Gateway shutdown exceeded 15 seconds")),
      15_000,
    );
    child.once("exit", () => {
      clearTimeout(timer);
      resolveExit();
    });
  });
}

async function authenticate(bootstrapUrl) {
  const parsed = new URL(bootstrapUrl);
  const secret = new URLSearchParams(parsed.hash.slice(1)).get("bootstrap");
  assert(secret);
  const origin = parsed.origin;
  const response = await fetch(`${origin}/api/v1/gateway-auth/bootstrap`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  const { csrfToken } = await response.json();
  assert(cookie && csrfToken);
  return { origin, cookie, csrfToken };
}

async function api(auth, path, body) {
  const response = await fetch(`${auth.origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: auth.origin,
      cookie: auth.cookie,
      ...(body === undefined
        ? {}
        : {
            "content-type": "application/json",
            "x-csrf-token": auth.csrfToken,
          }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  assert(response.ok, `${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

let gateway;
try {
  gateway = await startGateway();
  const auth = await authenticate(gateway.bootstrapUrl);
  const preview = await api(auth, "/api/v1/workspace-registration-previews", {
    commandId: commandId(),
    candidatePath: workspace,
  });
  const createdWorkspace = await api(auth, "/api/v1/workspaces", {
    commandId: commandId(),
    previewId: preview.result.previewId,
    name: "Real Pi compatibility",
  });
  const createdSession = await api(
    auth,
    `/api/v1/workspaces/${createdWorkspace.result.workspaceId}/sessions`,
    { commandId: commandId(), name: "Candidate session" },
  );
  await stopGateway(gateway.child);
  gateway = undefined;

  const dbPath =
    process.platform === "win32"
      ? join(dataDir, "Data", "app.sqlite3")
      : join(dataDir, "app.sqlite3");
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db
    .prepare("SELECT source_path FROM sessions WHERE session_id=?")
    .get(createdSession.result.sessionId);
  db.close();
  assert(row?.source_path?.endsWith(".jsonl"));

  const pi = await import("@earendil-works/pi-coding-agent");
  const reopened = pi.SessionManager.open(row.source_path);
  assert.equal(reopened.getSessionId(), createdSession.result.sessionId);
  assert.equal(reopened.getSessionName(), "Candidate session");
  const canary = `transcript-canary-${crypto.randomUUID()}`;
  const credential = `credential-canary-${crypto.randomUUID()}`;
  reopened.appendCustomEntry("release-ownership", { canary, credential });
  assert((await readFile(row.source_path, "utf8")).includes(canary));

  gateway = await startGateway();
  await stopGateway(gateway.child);
  gateway = undefined;
  const sqliteBytes = await readFile(dbPath);
  assert(
    !sqliteBytes.includes(Buffer.from(canary)),
    "SQLite captured Pi transcript canary",
  );
  assert(
    !sqliteBytes.includes(Buffer.from(credential)),
    "SQLite captured credential canary",
  );

  const previousProject = join(temp, "previous-pi");
  await mkdir(previousProject);
  await writeFile(
    join(previousProject, "package.json"),
    JSON.stringify({ private: true }),
  );
  const npmCli = process.env.npm_execpath;
  const npmArgs = [
    "install",
    "--no-audit",
    "--no-fund",
    `${support.pi.package}@${previous}`,
  ];
  const install = npmCli
    ? spawnSync(process.execPath, [npmCli, ...npmArgs], {
        cwd: previousProject,
        encoding: "utf8",
      })
    : process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm ${npmArgs.join(" ")}`], {
          cwd: previousProject,
          encoding: "utf8",
        })
      : spawnSync("npm", npmArgs, {
          cwd: previousProject,
          encoding: "utf8",
        });
  if (install.error) throw install.error;
  assert.equal(install.status, 0, install.stderr || install.stdout);
  const previousEntry = join(
    previousProject,
    "node_modules",
    "@earendil-works",
    "pi-coding-agent",
    "dist",
    "index.js",
  );
  try {
    const previousProbe = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `const pi = await import(${JSON.stringify(pathToFileURL(previousEntry).href)}); const session = pi.SessionManager.open(${JSON.stringify(row.source_path)}); process.stdout.write(session.getSessionId());`,
      ],
      { encoding: "utf8" },
    );
    if (previousProbe.error) throw previousProbe.error;
    assert.equal(
      previousProbe.status,
      0,
      previousProbe.stderr || previousProbe.stdout,
    );
    assert.equal(
      previousProbe.stdout,
      createdSession.result.sessionId,
      `Pi ${previous} changed the native Session ID`,
    );
    await rm(barrier, { force: true });
  } catch (error) {
    await mkdir(join(root, ".scratch"), { recursive: true });
    await writeFile(
      barrier,
      JSON.stringify(
        { candidate, previous, fixture: row.source_path, error: String(error) },
        null,
        2,
      ),
    );
    throw new Error(
      `Rollback Barrier: Pi ${previous} cannot read candidate ${candidate} fixture`,
    );
  }

  console.log(
    `real-pi compatibility passed: candidate ${candidate}, previous ${previous}`,
  );
} finally {
  if (gateway)
    await stopGateway(gateway.child).catch(() => gateway.child.kill("SIGKILL"));
  await rm(temp, {
    recursive: true,
    force: true,
    maxRetries: process.platform === "win32" ? 5 : 0,
    retryDelay: 100,
  });
}
