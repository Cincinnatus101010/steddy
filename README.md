# skeg

Stale-while-revalidate data fetching for React. Same job as `useSWR`, rebuilt with one-way layers so reliability bugs cannot leak across concerns.

A skeg is the fin that keeps a hull tracking straight. This library does that for in-flight fetches.

Explainer: [https://cincinnatus101010.github.io/skegweb/](https://cincinnatus101010.github.io/skegweb/)

```bash
npm install skeg
```

```ts
import { useSkeg } from "skeg";

function Profile({ id }: { id: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSkeg(
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
import { defaultCoordinator, focusRevalidate, hydrate, clear } from "skeg";

hydrate("user", { name: "Ada" });
focusRevalidate(defaultCoordinator);
clear("user");
```

Need an isolated cache (tests, multiple trees): wrap with `SkegProvider` and pass `createStore()` + `createCoordinator(store)`.

## Architecture

```
plugins → coordinator → store
                ↑
              hooks
```

A new request for the same key **aborts** the in-flight one. Aborted requests do not write to the store. Optimistic `mutate` rolls back on error by default.

## License

MIT © Ian Troisi
