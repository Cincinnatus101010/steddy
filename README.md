# steddy

Stale-while-revalidate data fetching for React. Same job as `useSWR`, rebuilt with one-way layers so reliability bugs cannot leak across concerns.

The name is “steady” with intent: keep in-flight fetches on course so a stale response cannot roll the cache.

Explainer: [https://cincinnatus101010.github.io/steddyweb/](https://cincinnatus101010.github.io/steddyweb/)

```bash
npm install steddy
```

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

`key === null` skips fetching. Plugins (`focusRevalidate`, `reconnectRevalidate`, `pollingRevalidate`, `retryOnError`) are opt-in named exports.

```ts
import { defaultCoordinator, focusRevalidate, hydrate, clear } from "steddy";

hydrate("user", { name: "Ada" });
focusRevalidate(defaultCoordinator);
clear("user");
```

Need an isolated cache (tests, multiple trees, SSR): wrap with `SteddyProvider` and pass `createStore()` + `createCoordinator(store)`, or `createRuntime()`. Pass `cache={dump(store)}` across an RSC boundary. `{ suspense: true }` throws the in-flight waiter. `{ keepPreviousData: true }` keeps the last value on screen while a new key loads. `useSteddyInfinite` keeps one cache entry per page; `mutate` writes every page, and `getKey` stops when a later page would reuse an earlier key. `ttlEvict` drops unused keys.

## Architecture

```
plugins → coordinator → store
                ↑
              hooks
```

A new request for the same key **aborts** the in-flight one. Aborted requests do not write to the store. The last subscriber’s unmount delays that abort by a tick so a remount can reuse the waiter. Optimistic `mutate` rolls back on error by default.

## License

MIT © Ian Troisi
