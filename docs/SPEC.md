# Spec: Leeboard

The product is **Leeboard**. The npm package is **`leeboard`**.

## Objective

Leeboard is a stale-while-revalidate data-fetching library for React. It does the same job as `useSWR`, rebuilt with strict one-way layering so reliability bugs cannot leak across concerns.

**Success:** the reliability checklist in this spec is covered by tests, the public hook is thin, and plugins are tree-shaken when unused.

**Non-goals for v1:** GraphQL helpers. SSR dump/hydrate, suspense, infinite pages, and TTL eviction are in.

## Tech Stack

- TypeScript (strict)
- React 18+ (`useSyncExternalStore`) as a peer dependency
- Vitest + Testing Library + jsdom
- tsup for ESM/CJS builds
- esbuild in tests for the tree-shaking check

## Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run the full test suite once |
| `npm run test:watch` | Vitest watch mode |
| `npm run build` | Emit `dist/` |
| `npm run typecheck` | `tsc --noEmit` |

## Project Structure

```
src/
  store.ts           # 2.1 — no imports from coordinator, plugins, or fetch
  coordinator.ts     # 2.2 — imports store types/instances only
  key.ts             # 2.3 — standalone
  mutate.ts          # 2.6 — store + coordinator
  useLeeboard.ts         # 2.5 — runtime (store, coordinator, mutate)
  context.tsx        # LeeboardProvider, hydrate, clear, default runtime
  defaults.ts        # singleton store + coordinator
  types.ts           # public types
  plugins/
    focus.ts
    reconnect.ts
    polling.ts
    retry.ts
  index.ts
tests/               # colocated as *.test.ts next to modules; extra checks in tests/
docs/
  SPEC.md
  decisions/
```

## Code Style

```ts
const { data, error, isLoading, isValidating, mutate } = useLeeboard(
  ['user', id],
  (key) => fetchUser(key[1]),
);
```

- Named exports only. No default export.
- Layers may not import upward. Plugins never import the store.
- `error` is `unknown`. Fetchers throw whatever they throw; Leeboard does not wrap it.

## Testing Strategy

- Unit tests per layer, including store tests that never import coordinator or plugins.
- Coordinator tests cover abort-vs-race and last-subscriber abort.
- Hook tests via `renderHook` for subscribe/unmount behavior.
- Plugin tests with a mock coordinator and no React.
- One esbuild tree-shake test: `import { useLeeboard }` must not contain plugin implementations.

## Boundaries

- **Always:** keep dependency direction `plugins → coordinator → store`; `hooks` only call downward. Aborted requests never write to the store. Rollback on mutation error is on by default.
- **Ask first:** GraphQL helpers, user-facing config knobs beyond `{ suspense: true }`.
- **Never:** add `fetch` to `store.ts`; let two in-flight requests for the same key both write; import plugins from `useLeeboard.ts`.

## Success Criteria

1. Two rapid `revalidate` calls for the same key: only the second response is stored; the first is aborted.
2. Last subscriber unmount aborts in-flight work; no throw; store is not updated by the aborted request.
3. Failed optimistic mutation restores the exact prior `CacheEntry`, including `error`.
4. Store tests pass with coordinator/plugins absent from the import graph.
5. Bundling only `useLeeboard` excludes focus/reconnect/polling/retry code.

## Resolved v1 Decisions

See `docs/decisions/001-v1-open-questions.md`.

- Cache: TTL/`maxKeys` eviction is a plugin (`ttlEvict`) calling `coordinator.evict`. Unused keys only — never in-flight or subscribed.
- `mutate` is a global export against the singleton store/coordinator. The hook also returns a key-bound `mutate`.
- `error` stays `unknown`. No `LeeboardError` wrapper.
