# ADR-001: v1 answers to the design-doc open questions

## Status

Accepted

## Date

2026-09-17

## Context

The Leeboard design doc left three questions open: cache GC, whether `mutate` exists outside React, and error typing. v1 needs a conservative default for each so layers stay simple and testable.

## Decision

1. **No cache eviction in v1.** Entries stay in the store until the process dies or tests call `clear()`. Unmounting the last subscriber **aborts** an in-flight request (reliability checklist item 2) but does not delete cached data. LRU/TTL would require the store to know about time or usage policy; that can be a plugin later.

2. **Global `mutate` exists.** SWR’s imperative `mutate` is load-bearing for event handlers and non-React code. v1 exports `mutate(key, updater, options)` against a module singleton (`defaultStore` / `defaultCoordinator`). `useLeeboard` returns a bound `mutate` from the current runtime (`LeeboardProvider` or the default). `hydrate` and `clear` seed or drop keys on that same cache.

3. **`error` is `unknown`.** Wrapping every fetcher rejection in `LeeboardError` would invent a shape fetchers did not throw and hide `instanceof` checks users already have. The store records whatever was thrown.

## Alternatives Considered

### Evict on last unsubscribe

- Pros: bounded memory
- Cons: loses SWR-style instant restore when remounting a recently viewed screen; mixes GC policy into the store
- Rejected for v1: the spec listed “manual only” as an option; keep the store dumb

### Hook-only mutate

- Pros: no singleton
- Cons: cannot update cache from route loaders, websockets, or event handlers outside the component that called `useLeeboard`
- Rejected: the design doc already leaned toward a global form

### `LeeboardError` wrapper

- Pros: consistent `{ status, cause }` for UI
- Cons: every fetcher would be wrapped; users lose the original type; v1 has no standard error protocol
- Rejected: keep `unknown`

## Consequences

- Long-lived apps can accumulate unused keys; eviction is a follow-up.
- Tests must `clear()` / `reset()` the singleton between cases.
- UI code that wants a discriminated error must narrow `unknown` itself.

## Additional v1 contract (abort vs dedup)

These two sentences in the design doc can conflict: “a new request aborts the old one” and “dedup window of ~2s.”

**In-flight:** `coordinator.revalidate` always aborts the current request for that key and starts a new one. Only the latest generation may write. This is checklist item 1.

**Completed:** if the last **successful** write for that key is newer than `DEDUP_WINDOW_MS` (2000), `revalidate` is a no-op unless the caller passes `{ force: true }` (used after a successful mutation).

**Multiple hook subscribers:** `useLeeboard` does not call `revalidate` when `isInFlight(key)` is already true, so two mounted components share one request instead of aborting each other.

**Retry plugin:** retries wrap the fetcher (same in-flight generation). They must not call `revalidate`, which would abort the request being retried.
