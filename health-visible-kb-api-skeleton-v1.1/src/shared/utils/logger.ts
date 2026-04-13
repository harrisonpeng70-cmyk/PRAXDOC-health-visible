export function logInfo(message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.log(`[INFO] ${message}`);
    return;
  }
  console.log(`[INFO] ${message}`, payload);
}

export function logError(message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.error(`[ERROR] ${message}`);
    return;
  }
  console.error(`[ERROR] ${message}`, payload);
}
