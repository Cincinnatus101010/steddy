import type { Fetcher } from "../types";

export type RetryCoordinator = {
  revalidate(key: string): Promise<void>;
};

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Wraps a fetcher with bounded backoff retries.
 * Retries happen inside the in-flight request. Do not call `coordinator.revalidate`
 * here — that would abort the request being retried.
 */
export function retryOnError<T>(
  _coordinator: RetryCoordinator,
  options: { attempts: number; backoff: number },
): (fetcher: Fetcher<T>) => Fetcher<T> {
  return (fetcher) =>
    async (key, context) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < options.attempts; attempt++) {
        if (context.signal.aborted) {
          throw (
            context.signal.reason ?? new DOMException("Aborted", "AbortError")
          );
        }
        try {
          return await fetcher(key, context);
        } catch (error) {
          lastError = error;
          if (isAbortError(error) || attempt === options.attempts - 1) {
            break;
          }
          await sleep(options.backoff * 2 ** attempt, context.signal);
        }
      }
      throw lastError;
    };
}
