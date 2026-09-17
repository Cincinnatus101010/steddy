# Steddy — agent notes

Dependency direction is one-way. No exceptions.

```
plugins → coordinator → store
                ↑
              hooks
```

- `src/store.ts` is a dumb `Map` with subscriptions. No `fetch`, timers, focus, or network events. If a change adds any of those, reject it.
- Plugins call `coordinator.revalidate(key)` (or wrap a fetcher, for retry). They never import the store.
- `useSteddy.ts` only registers, subscribes, and calls coordinator/mutate via `useSteddyRuntime()`. No retry/dedup/focus logic.
- Isolated caches go through `SteddyProvider`. `hydrate` / `hydrateAll` / `dump` / `clear` are store+coordinator helpers, not a new layer.
- Aborted requests do not write to the store. They are not errors.
- Suspense is hook-only: `{ suspense: true }` throws the in-flight waiter, then the error.
- `useSteddyInfinite` uses one cache entry per page. Do not add a second cache shape to the coordinator.
- `ttlEvict` is a plugin. It calls `coordinator.evict`. The store stays dumb.
