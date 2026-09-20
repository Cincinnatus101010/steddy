# Debugging and observability

## Coordinator events

`coordinator.subscribe(listener)` receives:

| Event | Meaning |
|-------|---------|
| `start` | New in-flight fetch for a key |
| `abort` | Previous generation aborted |
| `dedup` | Revalidate skipped (fresh cache, no `force`) |
| `write` | Successful store write |
| `error` | Fetch failed (non-abort) |

Use in tests or a dev-only logger plugin. Plugins must not import the store.

## `measurePerf`

```ts
import { measurePerf } from "steddy";

const perf = measurePerf(coordinator);
// after some traffic…
console.log(perf.snapshot());
// { starts, aborts, dedups, writes, errors, totalMs }
```

Subscribe once at the app root alongside `attachDefaults`. Run `npm run bench` for coordinator microbenchmarks.

## Common misconfigurations

### Polling appears stuck

`refetchInterval` ticks use **`force: true`** — they should not be blocked by dedup. If polls still look stuck, check the fetcher, network tab, and that the hook key is non-null.

### Focus refresh too aggressive

Focus/reconnect call `revalidate` **without** `force`, so they honor `staleTime` / `dedupTime`. Raise dedup or stale window to reduce background traffic.

### Wrong cache after `mutate`

You likely used global `mutate` while `SteddyProvider` uses an isolated runtime. Switch to `useSteddyRuntime().mutate`.

### SSR hydration double-fetch

Ensure `dump` timestamps are passed through `hydrateAll` unchanged. Identical fingerprint on the provider skips re-hydration.

## Store inspection

`runtime.store.get(serializeKey(key))` returns `{ data, hasData, error, timestamp, isValidating }`. There is no public devtools panel in v0.2; use coordinator events or temporary logging.
