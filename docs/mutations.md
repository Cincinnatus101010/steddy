# Mutations and imperative cache access

## Hook `mutate`

Each `useSteddy` call returns a key-bound `mutate`. It always uses the active `SteddyProvider` runtime (or the module default if none).

```ts
const { mutate } = useSteddy(["user", id], fetchUser);
await mutate({ ...data, name: "Ada" }, { revalidate: true });
```

Optimistic updates roll back on error by default (`rollbackOnError: true`).

## Runtime helpers (`createRuntime` / `useSteddyRuntime`)

`createRuntime()` and `useSteddyRuntime()` expose the same imperative API:

| Method | Role |
|--------|------|
| `mutate(key, updater, options?)` | Optimistic write + optional `{ force: true }` revalidate |
| `revalidate(key, options?)` | Refetch one key; `{ force: true }` bypasses dedup |
| `revalidateMatching(matcher, options?)` | Refetch every **registered** key where `matcher(serialized, key)` is true |
| `prefetch(key, fetcher)` | Warm cache without a mounted hook |
| `clear(key?)` | Drop one key or reset the whole cache |

`revalidateMatching` only hits keys with an active registration (mounted hook or in-flight prefetch). Match on `serialized` for tuple keys, e.g. `serialized.startsWith('["followed-train"')`.

## Global `mutate` export

```ts
import { mutate } from "steddy";
```

This uses **`defaultStore` / `defaultCoordinator`**, not your `SteddyProvider` cache. In apps with `createRuntime()`, prefer hook `mutate`, `useSteddyRuntime().mutate`, or `createMutate(store, coordinator)` wired to the same store as the provider.

In development, calling global `mutate` while a non-default provider is mounted logs a console warning.

## `createMutate`

Exported for modules outside React:

```ts
import { createMutate, createRuntime } from "steddy";

const runtime = createRuntime();
const mutateUser = createMutate(runtime.store, runtime.coordinator);
```

Pass the same `store` and `coordinator` instances as `SteddyProvider`.
