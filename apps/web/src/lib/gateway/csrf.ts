/**
 * In-memory CSRF token holder. The token lives only for the lifetime of this
 * module instance — never in localStorage, Pinia, Query cache, or logs.
 */
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}
