import { ApiError } from "./api";

export const POLL_INTERVAL_MS = 2000;
export const PERSISTENT_FAILURE_MS = 15_000;

export function pollRetryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 3000);
}

export function payRetryDelay(attempt: number): number {
  return Math.min(600 * 2 ** attempt, 4000);
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 408 || error.status === 429 || error.status >= 500;
  return true;
}
