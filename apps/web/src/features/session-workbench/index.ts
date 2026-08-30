import { inject, provide, type InjectionKey } from "vue"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import { useSessionLifecycle } from "@features/session-workbench/hooks/use-session.js"

export type SessionContext = ReturnType<typeof createSession>
export const sessionKey: InjectionKey<SessionContext> = Symbol("session")

function createSession(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
) {
  const session = useSessionLifecycle(pi, cwd)
  return {
    sessionId: session.sessionId,
    projection: session.projection,
    phase: session.phase,
    running: session.running,
    phaseText: session.phaseText,
    sessionPending: session.sessionPending,
    connecting: session.connecting,
    connected: session.connected,
    connectionError: session.connectionError,
    transcript: session.transcript,
    sessionCwd: session.sessionCwd,
    contextUsage: session.contextUsage,
    catalog: session.catalog,
    preset: session.preset,
    prompt: session.prompt,
    clientState: session.clientState,
    sessionError: session.sessionError,
    creating: session.creating,
    aborting: session.aborting,
    createSession: session.createSession,
    createAndSubmit: session.createAndSubmit,
    submitText: session.submitText,
    abortSession: session.abortSession,
    applyThreadState: session.applyThreadState,
    initialize: session.initialize,
  }
}

export function provideSession(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
) {
  const session = createSession(pi, cwd)
  provide(sessionKey, session)
  return session
}

export function useSession(): SessionContext {
  const session = inject(sessionKey)
  if (!session) throw new Error("useSession() 需要在 provideSession() 之后调用")
  return session
}
