# Changelog

## 0.1.4

- `useSteddy` options `{ refetchInterval }` and `{ refetchWhenHidden }` for mount-time polling that reads the latest interval each tick
- `pollingRevalidate` accepts `{ whenVisible }` to skip polls while the document is hidden
- Export `useSteddyRuntime` for manual `coordinator.revalidate` outside the hook

## 0.1.3

- `prefetch`, `attachDefaults`, per-hook `staleTime`, `CacheEntry.hasData` for undefined payloads
- Provider hydrates in an effect; `hydrateAll` preserves dump timestamps
- Store skips notify on unchanged entries; focus/reconnect use visibility and subscribed keys
- Dev warning when using the default cache on the server without `SteddyProvider`

## 0.1.2

- `measurePerf` plugin and coordinator microbenchmarks

## 0.1.1

- `keepPreviousData`, delayed last-subscriber abort, infinite `mutate` and cursor `collectPages`

## 0.1.0

- Initial release
