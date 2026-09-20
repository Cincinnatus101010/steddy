import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export type DocId =
  | "readme"
  | "spec"
  | "changelog"
  | "agents"
  | "setup"
  | "architecture"
  | "hooks"
  | "plugins"
  | "ssr"
  | "nextjs"
  | "mutations"
  | "debugging"
  | "infinite"
  | "reliability";

type DocEntry = {
  id: DocId;
  title: string;
  uri: `steddy://docs/${string}`;
  load: () => string;
};

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

const TOPICS: Record<
  Exclude<
    DocId,
    "readme" | "spec" | "changelog" | "agents" | "nextjs" | "mutations" | "debugging"
  >,
  string
> = {
  setup: `# App setup

- One \`createRuntime()\` per app tree. On the server: **one runtime per request** — never share the module default across requests.
- Wrap with \`SteddyProvider\` and call \`attachDefaults(coordinator, store)\` once at the root (focus, reconnect, TTL via \`ttlEvict\`).
- \`runtime.prefetch(key, fetcher)\` or \`prefetch(key, fetcher, runtime)\` warms cache without mounting \`useSteddy\`.
- Pass \`store\` into \`focusRevalidate\` / \`reconnectRevalidate\` so only **subscribed** keys revalidate.

\`\`\`tsx
useEffect(() => attachDefaults(runtime.coordinator, runtime.store), []);
\`\`\`

Use \`useSteddyRuntime()\` for \`revalidate\`, \`revalidateMatching\`, \`mutate\`, \`clear\` — same cache as hooks.
`,
  architecture: `# Architecture

\`\`\`
plugins → coordinator → store
                ↑
              hooks
\`\`\`

- Store: dumb Map + subscriptions. No fetch, timers, or browser events.
- Coordinator: register, revalidate, revalidateMatching, abort in-flight, dedup window, evict.
- Hooks: register + subscribe only; no plugin imports in \`useSteddy.ts\`.
- Aborted requests **never write** to the store.
`,
  hooks: `# useSteddy

\`\`\`ts
useSteddy(key, fetcher, {
  suspense?: boolean;
  keepPreviousData?: boolean;
  staleTime?: number;      // dedup default 2000ms
  dedupTime?: number;      // overrides staleTime for dedup
  refetchInterval?: number; // poll; each tick force-fetches
  refetchWhenHidden?: boolean;
  fallbackData?: T;
  onSuccess?: (data, key) => void;
  onError?: (error, key) => void;
})
\`\`\`

Returns \`data\`, \`error\` (\`unknown\`), \`isLoading\`, \`isValidating\`, \`mutate\`.

- \`key === null\` skips fetch.
- \`isLoading\` means the key never settled (\`hasData\` false), not \`data === undefined\` (see \`fallbackData\`).
- \`refetchInterval\` ignores dedup; use long \`dedupTime\` for focus/reconnect without blocking polls.
- Pass \`signal\` from the fetcher context into \`fetch\`.
`,
  plugins: `# Plugins (opt-in exports)

| Export | Role |
|--------|------|
| \`attachDefaults(coordinator, store)\` | focus + reconnect + ttlEvict |
| \`focusRevalidate(coordinator, store?)\` | visibilitychange; optional subscriber filter |
| \`reconnectRevalidate(coordinator, store?)\` | online |
| \`pollingRevalidate\` | interval revalidate for a single key (no mounted hook) |
| \`retryOnError\` | fetcher wrapper (not in attachDefaults) |
| \`ttlEvict\` | calls \`coordinator.evict\` |
| \`measurePerf\` | coordinator event counters |

Prefer hook \`refetchInterval\` for component polling. Use \`pollingRevalidate\` when nothing is subscribed.

Tree-shaking: importing only \`useSteddy\` must not bundle plugin code.
`,
  ssr: `# SSR / RSC

1. Server: \`const runtime = createRuntime()\`, fetch, optionally \`hydrate\`.
2. \`const cache = dump(runtime.store)\` — JSON-safe; errors omitted.
3. Client: \`<SteddyProvider cache={cache} …>\` — hydrates in an effect; identical snapshot fingerprint skipped.
4. \`hydrateAll\` preserves **timestamps** from dump so dedup can skip immediate refetch.

See topic **nextjs** for App Router layout pattern.

Dev warning if \`useSteddy\` runs on the server without \`SteddyProvider\` (default singleton).
`,
  infinite: `# useSteddyInfinite

- One cache entry **per page key**.
- \`mutate\` writes every page; supports function and array updaters with rollback.
- \`collectPages\` stops when \`getKey\` would reuse a serialized key (cursor safety).
`,
  reliability: `# Reliability checklist

1. Same key: new revalidate **aborts** the in-flight request; only the latest write wins.
2. Last subscriber unmount: abort after \`UNSUBSCRIBE_GRACE_MS\` (0ms default); remount can reuse waiter.
3. Optimistic mutate rolls back on error by default.
4. Store stays dumb — no network in \`store.ts\`.
5. Plugins never import the store.
6. Interval polling uses \`force\` revalidate so dedup does not stall live polls.
`,
};

const FILE_TOPICS: { id: DocId; title: string; path: string }[] = [
  { id: "nextjs", title: "Next.js App Router", path: "docs/nextjs.md" },
  { id: "mutations", title: "Mutations & imperative API", path: "docs/mutations.md" },
  { id: "debugging", title: "Debugging & observability", path: "docs/debugging.md" },
];

export const DOC_ENTRIES: DocEntry[] = [
  {
    id: "readme",
    title: "README",
    uri: "steddy://docs/readme",
    load: () => readRepoFile("README.md"),
  },
  {
    id: "spec",
    title: "SPEC",
    uri: "steddy://docs/spec",
    load: () => readRepoFile("docs/SPEC.md"),
  },
  {
    id: "changelog",
    title: "Changelog",
    uri: "steddy://docs/changelog",
    load: () => readRepoFile("CHANGELOG.md"),
  },
  {
    id: "agents",
    title: "Agent layer rules",
    uri: "steddy://docs/agents",
    load: () => readRepoFile("AGENTS.md"),
  },
  ...FILE_TOPICS.map(({ id, title, path }) => ({
    id,
    title,
    uri: `steddy://docs/${id}` as const,
    load: () => readRepoFile(path),
  })),
  ...(
    Object.entries(TOPICS) as [Exclude<
      DocId,
      "readme" | "spec" | "changelog" | "agents" | "nextjs" | "mutations" | "debugging"
    >, string][]
  ).map(([id, body]) => ({
    id,
    title: id.charAt(0).toUpperCase() + id.slice(1),
    uri: `steddy://docs/${id}` as const,
    load: () => body.trim(),
  })),
];

export function getDoc(id: DocId): string {
  const entry = DOC_ENTRIES.find((item) => item.id === id);
  if (!entry) {
    throw new Error(`Unknown doc: ${id}`);
  }
  return entry.load();
}

export function searchDocs(query: string, limit = 8): { id: DocId; title: string; snippet: string }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const hits: { id: DocId; title: string; snippet: string; score: number }[] = [];
  for (const entry of DOC_ENTRIES) {
    const text = entry.load();
    const lower = text.toLowerCase();
    const index = lower.indexOf(needle);
    if (index === -1) {
      continue;
    }
    const start = Math.max(0, index - 60);
    const end = Math.min(text.length, index + needle.length + 80);
    hits.push({
      id: entry.id,
      title: entry.title,
      snippet: text.slice(start, end).replace(/\s+/g, " ").trim(),
      score: (lower.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map(({ id, title, snippet }) => ({ id, title, snippet }));
}

export const DOC_IDS = DOC_ENTRIES.map((entry) => entry.id);
