let pendingSecret: string | null = null;

/** Capture and remove one-time credential material before Router initialization. */
export function captureBootstrapSecret(): void {
  const match = /(?:^|[#&])bootstrap=([^&]+)/.exec(window.location.hash);
  const encoded = match?.[1];
  if (encoded === undefined) return;
  pendingSecret = decodeURIComponent(encoded);
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#/`,
  );
}

/** The bootstrap secret is readable exactly once and is never persisted. */
export function consumeBootstrapSecret(): string | null {
  const secret = pendingSecret;
  pendingSecret = null;
  return secret;
}
