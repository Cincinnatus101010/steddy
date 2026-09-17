# Skeg — agent notes

Dependency direction is one-way. No exceptions.

```
plugins → coordinator → store
                ↑
              hooks
```

- `src/store.ts` is a dumb `Map` with subscriptions. No `fetch`, timers, focus, or network events. If a change adds any of those, reject it.
- Plugins call `coordinator.revalidate(key)` (or wrap a fetcher, for retry). They never import the store.
- `useSkeg.ts` only registers, subscribes, and calls coordinator/mutate via `useSkegRuntime()`. No retry/dedup/focus logic.
- Isolated caches go through `SkegProvider`. `hydrate` / `clear` are store+coordinator helpers, not a new layer.
- Aborted requests do not write to the store. They are not errors.
- Do not add SSR, suspense, or pagination to core.
