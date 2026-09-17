# Leeboard — agent notes

Dependency direction is one-way. No exceptions.

```
plugins → coordinator → store
                ↑
              hooks
```

- `src/store.ts` is a dumb `Map` with subscriptions. No `fetch`, timers, focus, or network events. If a change adds any of those, reject it.
- Plugins call `coordinator.revalidate(key)` (or wrap a fetcher, for retry). They never import the store.
- `useLeeboard.ts` only registers, subscribes, and calls coordinator/mutate via `useLeeboardRuntime()`. No retry/dedup/focus logic.
- Isolated caches go through `LeeboardProvider`. `hydrate` / `hydrateAll` / `dump` / `clear` are store+coordinator helpers, not a new layer.
- Aborted requests do not write to the store. They are not errors.
- Suspense is hook-only: `{ suspense: true }` throws the in-flight waiter, then the error.
- `useLeeboardInfinite` uses one cache entry per page. Do not add a second cache shape to the coordinator.
- `ttlEvict` is a plugin. It calls `coordinator.evict`. The store stays dumb.
