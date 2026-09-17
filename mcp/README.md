# steddy-mcp

Model Context Protocol server for the [Steddy](https://github.com/Cincinnatus101010/steddy) React data-fetching library. Exposes README, SPEC, changelog, agent layer rules, and curated setup topics.

## Build

```bash
cd mcp
npm ci
npm run build
```

Run from the **steddy repo root** so relative paths resolve (`README.md`, `docs/SPEC.md`, etc.).

## Cursor

Add to `.cursor/mcp.json` (project) or Cursor MCP settings:

```json
{
  "mcpServers": {
    "steddy": {
      "command": "node",
      "args": ["/absolute/path/to/steddy/mcp/dist/index.js"]
    }
  }
}
```

Replace the path with your clone location. Rebuild after pulling doc changes.

## Tools

| Tool | Purpose |
|------|---------|
| `steddy_list_topics` | All topic ids |
| `steddy_get_topic` | Full markdown for one topic |
| `steddy_search_docs` | Keyword search with snippets |

## Resources

`steddy://docs/<id>` — same content as topics (readme, spec, setup, hooks, …).
