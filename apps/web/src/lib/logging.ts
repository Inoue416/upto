export function logError(message: string, error: unknown): void {
  // eslint-disable-next-line no-console -- Keep diagnostics in server/browser logs without exposing details to UI or API responses.
  console.error(message, error);
}

export function logWarning(message: string, error: unknown): void {
  // eslint-disable-next-line no-console -- Local persistence failures should remain visible for debugging.
  console.warn(message, error);
}
