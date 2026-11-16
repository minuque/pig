import { inject, provide, type InjectionKey } from "vue"
import { useSessionLifecycle } from "@features/session/hooks/use-session.js"

export type SessionContext = ReturnType<typeof useSessionLifecycle>

export const sessionKey: InjectionKey<SessionContext> = Symbol("session")

/** 把一侧 workbench 的会话交给子树；子树里的 useSession() 拿到的就是这一侧。 */
export function provideSession(session: SessionContext) {
  provide(sessionKey, session)
  return session
}

export function useSession(): SessionContext {
  const session = inject(sessionKey)

  if (!session) throw new Error("useSession() 需要在 provideSession() 之后调用")
  return session
}

export { sessionTitle, untitledSession } from "@features/session/lib/session-title.js"

export { useSessionLifecycle } from "@features/session/hooks/use-session.js"

export { createSessionHub, type SessionHub } from "@features/session/hooks/use-session-hub.js"
