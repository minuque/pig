import { inject, provide, type InjectionKey } from "vue"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import { useSessionLifecycle } from "@features/session-workbench/hooks/use-session.js"

export type SessionContext = ReturnType<typeof useSessionLifecycle>

export const sessionKey: InjectionKey<SessionContext> = Symbol("session")

export function provideSession(
  pi: ReturnType<typeof usePiClient>,
  cwd: ReturnType<typeof useLocalWorkspaces>,
) {
  const session = useSessionLifecycle(pi, cwd)
  provide(sessionKey, session)
  return session
}

export function useSession(): SessionContext {
  const session = inject(sessionKey)

  if (!session) throw new Error("useSession() 需要在 provideSession() 之后调用")
  return session
}
