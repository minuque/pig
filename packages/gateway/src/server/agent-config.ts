import type { IncomingMessage, ServerResponse } from "node:http"
import type { AgentConfigScope, LoginEvent, McpExposure } from "@pig/protocol"
import { mcpConfigFile, readMcpScope, validateServer } from "../pi/mcp-config.js"
import { patchMcpServer, putMcpServer, removeMcpServer } from "../pi/mcp-config-write.js"
import type { PiHostService } from "../pi/service.js"
import {
  createSkill,
  deleteSkill,
  isKnownSkillPath,
  listSkills,
  readSkillFile,
  setSkillEnabled,
  writeSkillFile,
} from "../pi/skills-config.js"
import { HttpError, HttpRouter, type HttpDeps, type HttpRouteTable } from "./router.js"

export type AgentConfigDeps = HttpDeps & { hostService: PiHostService }

const EXPOSURES: readonly string[] = ["codemode", "deferred", "direct", "hidden"]

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function scopeOf(raw: unknown, deps: AgentConfigDeps): Promise<AgentConfigScope> {
  const scope = text(raw)

  if (scope === "global") return scope

  if (!scope || !(await deps.hostService.isKnownWorkspace(scope)))
    throw new HttpError(403, "FORBIDDEN")
  return scope
}

function changed(deps: AgentConfigDeps, scope: AgentConfigScope): void {
  deps.hostService.invalidateResources(scope === "global" ? undefined : scope)
}

function ownServer(deps: AgentConfigDeps, scope: AgentConfigScope, name: string) {
  const server = readMcpScope(deps.hostService.agentDir, scope).servers.find((s) => s.name === name)

  if (!server) throw new HttpError(404, "NOT_FOUND")
  return server
}

async function knownSkill(deps: AgentConfigDeps, scope: AgentConfigScope, path: string) {
  if (!path || !(await isKnownSkillPath(deps.hostService.agentDir, scope, path)))
    throw new HttpError(403, "FORBIDDEN")
  return path
}

function frame(event: LoginEvent): string {
  return `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

const agentConfigRoutes = {
  "GET /api/v1/platform/mcp": async ({ url, deps }) =>
    readMcpScope(deps.hostService.agentDir, await scopeOf(url.searchParams.get("scope"), deps)),

  "PUT /api/v1/platform/mcp/server": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)
    const name = text(payload.name)
    const result = validateServer(name, payload.config, scope === "global" ? "global" : "project")

    if ("error" in result) return { ok: false, error: result.error }
    const previous = text(payload.previousName)
    const taken = readMcpScope(ctx.deps.hostService.agentDir, scope).servers.some(
      (server) => server.name === name,
    )

    if (taken && previous !== name && payload.overwrite !== true)
      return { ok: false, error: `MCP server "${name}" already exists` }

    putMcpServer(
      mcpConfigFile(ctx.deps.hostService.agentDir, scope),
      name,
      payload.config as Record<string, unknown>,
      previous || undefined,
    )
    changed(ctx.deps, scope)
    return { ok: true }
  },

  "PATCH /api/v1/platform/mcp/server": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)
    const name = text(payload.name)

    ownServer(ctx.deps, scope, name)
    patchMcpServer(mcpConfigFile(ctx.deps.hostService.agentDir, scope), name, {
      ...(typeof payload.enabled === "boolean" ? { enabled: payload.enabled } : {}),
      ...(EXPOSURES.includes(text(payload.exposure))
        ? { exposure: text(payload.exposure) as McpExposure }
        : {}),
    })
    changed(ctx.deps, scope)
    return { ok: true }
  },

  "DELETE /api/v1/platform/mcp/server": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)
    const name = text(payload.name)

    ownServer(ctx.deps, scope, name)
    removeMcpServer(mcpConfigFile(ctx.deps.hostService.agentDir, scope), name)
    changed(ctx.deps, scope)
    return { ok: true }
  },

  "GET /api/v1/platform/mcp/probes": async ({ url, deps }) =>
    deps.hostService.mcpCli.cached(await scopeOf(url.searchParams.get("scope"), deps)),

  "POST /api/v1/platform/mcp/probe": async (ctx) => {
    const payload = await ctx.json()
    return ctx.deps.hostService.mcpCli.probe(await scopeOf(payload.scope, ctx.deps))
  },

  "POST /api/v1/platform/mcp/login": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)
    const name = text(payload.name)
    const view = readMcpScope(ctx.deps.hostService.agentDir, scope)
    const own = view.servers.find((s) => s.name === name)

    if (!own && !view.inherited.some((s) => s.name === name)) throw new HttpError(404, "NOT_FOUND")
    const local = scope !== "global" && own !== undefined && !own.override
    return { loginId: ctx.deps.hostService.mcpCli.login(scope, name, local) }
  },

  "GET /api/v1/platform/mcp/login/:loginId/events": async ({ res, url, params, deps }) => {
    const cli = deps.hostService.mcpCli

    if (!cli.hasLogin(params.loginId)) throw new HttpError(404, "NOT_FOUND")
    const after = Number(url.searchParams.get("after") ?? 0)
    const controller = new AbortController()

    res.once("close", () => controller.abort())
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    })

    try {
      for await (const event of cli.loginEvents(
        params.loginId,
        Number.isFinite(after) && after > 0 ? after : 0,
        controller.signal,
      ))
        res.write(frame(event))
    } finally {
      res.end()
    }
  },

  "POST /api/v1/platform/mcp/login/:loginId/cancel": async ({ params, deps }) => {
    deps.hostService.mcpCli.cancelLogin(params.loginId)
    return { ok: true }
  },

  "POST /api/v1/platform/mcp/logout": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)
    const name = text(payload.name)
    const own = readMcpScope(ctx.deps.hostService.agentDir, scope).servers.find(
      (s) => s.name === name,
    )

    await ctx.deps.hostService.mcpCli.logout(
      scope,
      name,
      scope !== "global" && own !== undefined && !own.override,
    )
    return { ok: true }
  },

  "GET /api/v1/platform/skill-settings": async ({ url, deps }) =>
    listSkills(deps.hostService.agentDir, await scopeOf(url.searchParams.get("scope"), deps)),

  "GET /api/v1/platform/skill-settings/file": async ({ url, deps }) => {
    const scope = await scopeOf(url.searchParams.get("scope"), deps)
    return readSkillFile(await knownSkill(deps, scope, text(url.searchParams.get("path"))))
  },

  "PUT /api/v1/platform/skill-settings/file": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)
    const path = await knownSkill(ctx.deps, scope, text(payload.path))

    if (typeof payload.raw !== "string") throw new HttpError(400, "INVALID_REQUEST")

    try {
      await writeSkillFile(path, payload.raw)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }

    changed(ctx.deps, scope)
    return { ok: true }
  },

  "POST /api/v1/platform/skill-settings": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)

    try {
      const filePath = await createSkill(
        ctx.deps.hostService.agentDir,
        scope,
        text(payload.name),
        text(payload.description),
      )

      changed(ctx.deps, scope)
      return { filePath }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  },

  "PATCH /api/v1/platform/skill-settings/enabled": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)
    const path = await knownSkill(ctx.deps, scope, text(payload.filePath))

    if (typeof payload.enabled !== "boolean") throw new HttpError(400, "INVALID_REQUEST")
    await setSkillEnabled(ctx.deps.hostService.agentDir, scope, path, payload.enabled)
    changed(ctx.deps, scope)
    return { ok: true }
  },

  "DELETE /api/v1/platform/skill-settings": async (ctx) => {
    const payload = await ctx.json()
    const scope = await scopeOf(payload.scope, ctx.deps)

    await deleteSkill(await knownSkill(ctx.deps, scope, text(payload.path)))
    changed(ctx.deps, scope)
    return { ok: true }
  },
} satisfies HttpRouteTable<AgentConfigDeps>
const agentConfigRouter = new HttpRouter<AgentConfigDeps>(agentConfigRoutes)

export function handleAgentConfigRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: AgentConfigDeps,
): Promise<boolean> {
  return agentConfigRouter.handle(req, res, url, deps)
}
