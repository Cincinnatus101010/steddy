# Steddy

Stale-while-revalidate data fetching for React. Same job as `useSWR`, rebuilt with one-way layers so reliability bugs cannot leak across concerns.

The name is “steady” with intent: keep in-flight fetches on course so a stale response cannot roll the cache.

Explainer: [https://cincinnatus101010.github.io/steddyweb/](https://cincinnatus101010.github.io/steddyweb/) · [API](https://cincinnatus101010.github.io/steddyweb/docs/api) · MCP: [`mcp/README.md`](mcp/README.md)

```bash
npm install steddy
```

## App root

Wire an isolated runtime once. On the server, create a **new** runtime per request — do not rely on the module singleton.

```tsx
import { useEffect } from "react";
import {
  attachDefaults,
  createRuntime,
  SteddyProvider,
} from "steddy";

const runtime = createRuntime();

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => attachDefaults(runtime.coordinator, runtime.store), []);
  return (
    <SteddyProvider store={runtime.store} coordinator={runtime.coordinator}>
      {children}
    </SteddyProvider>
  );
}
```

See [`docs/nextjs.md`](docs/nextjs.md) for App Router SSR/hydrate flow.

## Hook

```ts
import { useSteddy } from "steddy";

function Profile({ id }: { id: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSteddy(
    ["user", id],
    async ([, userId], { signal }) => {
      const response = await fetch(`/api/users/${userId}`, { signal });
      if (!response.ok) throw new Error("failed");
      return response.json();
    },
    {
      keepPreviousData: true,
      staleTime: 60_000,
      dedupTime: 60_000,
      fallbackData: { name: "…" },
      onSuccess: (data) => console.log("loaded", data),
    },
  );

  if (error) return <p>Failed to load</p>;
  if (isLoading) return <p>Loading…</p>;
  return (
    <div>
      <h1>{data.name}</h1>
      <button onClick={() => mutate({ ...data, name: "Ada" })}>Rename</button>
      {isValidating ? <small>Refreshing…</small> : null}
    </div>
  );
}
```

`key === null` skips fetching.

| Option | Role |
|--------|------|
| `staleTime` | Dedup window for mount, focus, reconnect, manual `revalidate` (default 2000ms) |
| `dedupTime` | Overrides `staleTime` for dedup only |
| `refetchInterval` | Poll while mounted; **always fetches** on each tick (ignores dedup) |
| `refetchWhenHidden` | When true, interval polls while the tab is hidden |
| `fallbackData` | UI placeholder until the first fetch settles |
| `onSuccess` / `onError` | Hook-only callbacks after fetch settle |
| `keepPreviousData` | Keep last value while the key changes |
| `suspense` | Throw in-flight promise, then error |

**Polling:** use `refetchInterval` for live data. Dedup (`staleTime` / `dedupTime`) still applies to focus/reconnect; interval ticks do not.

## Runtime helpers

`createRuntime()` and `useSteddyRuntime()` expose:

- `mutate(key, updater, options?)`
- `revalidate(key, { force?: boolean })`
- `revalidateMatching((serialized, key) => boolean, options?)`
- `prefetch(key, fetcher)` · `clear(key?)`

See [`docs/mutations.md`](docs/mutations.md). Prefer these (or hook `mutate`) over the global `import { mutate } from "steddy"` when using `SteddyProvider` — the export targets the module default cache.

## Helpers

```ts
import {
  createRuntime,
  dump,
  hydrateAll,
  prefetch,
  clear,
  createMutate,
} from "steddy";

await prefetch(["user", id], fetchUser, runtime);
clear("user", runtime);
```

## Plugins (opt-in)

```ts
import { attachDefaults, focusRevalidate, measurePerf } from "steddy";

focusRevalidate(coordinator, store);
const perf = measurePerf(coordinator);
```

Also: `reconnectRevalidate`, `pollingRevalidate`, `retryOnError`, `ttlEvict`, `useSteddyInfinite`.

`attachDefaults` wires focus, reconnect, and TTL eviction (`ttlEvict` → `coordinator.evict`).

Debugging: [`docs/debugging.md`](docs/debugging.md) · `npm run bench`

## Architecture

```
plugins → coordinator → store
                ↑
              hooks
```

A new request for the same key **aborts** the in-flight one. Aborted requests do not write to the store. The last subscriber’s unmount delays that abort by a tick so a remount can reuse the waiter. Optimistic `mutate` rolls back on error by default.

## License

MIT © Ian Troisi
