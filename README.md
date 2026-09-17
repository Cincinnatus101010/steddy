# leeboard

Stale-while-revalidate data fetching for React. Same job as `useSWR`, rebuilt with one-way layers so reliability bugs cannot leak across concerns.

A leeboard is the pivoting fin that keeps a hull from sliding sideways. This library does that for in-flight fetches.

Explainer: [https://cincinnatus101010.github.io/leeboardweb/](https://cincinnatus101010.github.io/leeboardweb/)

```bash
npm install leeboard
```

```ts
import { useLeeboard } from "leeboard";

function Profile({ id }: { id: string }) {
  const { data, error, isLoading, isValidating, mutate } = useLeeboard(
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
import { defaultCoordinator, focusRevalidate, hydrate, clear } from "leeboard";

hydrate("user", { name: "Ada" });
focusRevalidate(defaultCoordinator);
clear("user");
```

Need an isolated cache (tests, multiple trees, SSR): wrap with `LeeboardProvider` and pass `createStore()` + `createCoordinator(store)`, or `createRuntime()`. Pass `cache={dump(store)}` across an RSC boundary. `{ suspense: true }` throws the in-flight waiter. `useLeeboardInfinite` keeps one cache entry per page. `ttlEvict` drops unused keys.

## Architecture

```
plugins → coordinator → store
                ↑
              hooks
```

A new request for the same key **aborts** the in-flight one. Aborted requests do not write to the store. Optimistic `mutate` rolls back on error by default.

## License

MIT © Ian Troisi
