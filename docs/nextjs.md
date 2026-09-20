# Next.js App Router

Steddy fits Next.js when you treat the cache like any other request-scoped resource on the server and a single long-lived runtime on the client.

## Client tree

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { attachDefaults, createRuntime, SteddyProvider } from "steddy";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const runtime = useMemo(() => createRuntime(), []);

  useEffect(() => attachDefaults(runtime.coordinator, runtime.store), [runtime]);

  return (
    <SteddyProvider store={runtime.store} coordinator={runtime.coordinator}>
      {children}
    </SteddyProvider>
  );
}
```

Mount providers in `app/layout.tsx` (or a client wrapper imported from the layout). Do **not** reuse one `createRuntime()` across server requests.

## Server fetch + client hydrate

1. In a Server Component or route handler, `const runtime = createRuntime()`.
2. `await runtime.prefetch(key, fetcher)` or call fetchers directly and `hydrate(key, data, runtime.store)`.
3. `const cache = dump(runtime.store)` — JSON-safe (`data` + `timestamp` only).
4. Pass `cache` to a client `SteddyProvider`:

```tsx
<SteddyProvider store={client.store} coordinator={client.coordinator} cache={cache}>
  {children}
</SteddyProvider>
```

`hydrateAll` runs in an effect on the client and preserves timestamps so dedup can skip an immediate duplicate fetch.

## Imperative updates

Use **`useSteddyRuntime()`** (or values from `createRuntime()`) for cache work outside hooks:

- `runtime.mutate(key, updater, { revalidate: true })`
- `runtime.revalidate(key, { force: true })`
- `runtime.revalidateMatching((serialized) => serialized.startsWith("["), { force: true })`
- `runtime.prefetch(key, fetcher)` · `runtime.clear(key?)`

Avoid the top-level `import { mutate } from "steddy"` when a `SteddyProvider` is active — that form targets the module default cache (see **mutations** topic).

## Polling live data

Use `useSteddy` with `{ refetchInterval }`. Interval ticks **always fetch** (`force`), independent of `staleTime` / `dedupTime`. Use a longer dedup window for focus/reconnect if you want fewer background hits.

## Dev warnings

- Server render without `SteddyProvider` (shared default singleton).
- Global `mutate()` while a non-default provider is mounted.
