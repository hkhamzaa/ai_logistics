import { createChildLogger } from './logger';

const log = createChildLogger('retry');

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        log.warn({ attempt, delay, err }, 'Retrying after error');
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}
