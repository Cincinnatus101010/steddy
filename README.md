# steddy

Stale-while-revalidate data fetching for React. Same job as `useSWR`, rebuilt with one-way layers so reliability bugs cannot leak across concerns.

The name is “steady” with intent: keep in-flight fetches on course so a stale response cannot roll the cache.

Explainer: [https://cincinnatus101010.github.io/steddyweb/](https://cincinnatus101010.github.io/steddyweb/) · [Docs](https://cincinnatus101010.github.io/steddyweb/docs) · MCP: [`mcp/README.md`](mcp/README.md)

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

For Next.js / RSC: fetch on the server, `dump(runtime.store)`, pass `cache={payload}` into `SteddyProvider` on the client. `hydrateAll` preserves timestamps from `dump` so dedup can skip an immediate refetch.

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
    { keepPreviousData: true, staleTime: 60_000 },
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

`key === null` skips fetching. Options: `{ suspense: true }`, `{ keepPreviousData: true }`, `{ staleTime }` (default 2000ms dedup window).

## Helpers

```ts
import {
  createRuntime,
  dump,
  hydrateAll,
  prefetch,
  clear,
} from "steddy";

// Route loader / link hover — no mounted hook required
await prefetch(["user", id], fetchUser, runtime);

clear("user", runtime);
```

## Plugins (opt-in)

```ts
import { attachDefaults, focusRevalidate, measurePerf } from "steddy";

// Or wire individually — pass store so focus/reconnect only hit subscribed keys
focusRevalidate(coordinator, store);

const perf = measurePerf(coordinator);
```

Also: `reconnectRevalidate`, `pollingRevalidate`, `retryOnError` (fetcher wrapper), `ttlEvict`, `useSteddyInfinite`.

`measurePerf(coordinator)` returns `{ starts, aborts, dedups, writes, errors, totalMs }`. Run `npm run bench` for coordinator microbenchmarks.

## Architecture

```
plugins → coordinator → store
                ↑
              hooks
```

A new request for the same key **aborts** the in-flight one. Aborted requests do not write to the store. The last subscriber’s unmount delays that abort by a tick so a remount can reuse the waiter. Optimistic `mutate` rolls back on error by default.

## License

MIT © Ian Troisi
