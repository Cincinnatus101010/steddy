#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  DOC_ENTRIES,
  DOC_IDS,
  type DocId,
  getDoc,
  searchDocs,
} from "./docs.js";

const TopicSchema = z.enum(DOC_IDS as [DocId, ...DocId[]]);

const server = new McpServer({
  name: "steddy",
  version: "0.1.0",
  websiteUrl: "https://cincinnatus101010.github.io/steddyweb/docs",
});

for (const entry of DOC_ENTRIES) {
  server.registerResource(
    entry.id,
    entry.uri,
    {
      title: entry.title,
      description: `Steddy documentation: ${entry.title}`,
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: entry.uri,
          mimeType: "text/markdown",
          text: entry.load(),
        },
      ],
    }),
  );
}

server.registerTool(
  "steddy_get_topic",
  {
    description:
      "Return full Steddy documentation for a topic (setup, hooks, SSR, plugins, architecture, etc.).",
    inputSchema: {
      topic: TopicSchema.describe("Documentation topic id"),
    },
  },
  async ({ topic }) => ({
    content: [{ type: "text", text: getDoc(topic) }],
  }),
);

server.registerTool(
  "steddy_search_docs",
  {
    description: "Search Steddy docs by keyword and return matching snippets with topic ids.",
    inputSchema: {
      query: z.string().min(1).describe("Search string"),
      limit: z.number().int().min(1).max(20).optional(),
    },
  },
  async ({ query, limit }) => {
    const hits = searchDocs(query, limit ?? 8);
    const text =
      hits.length === 0
        ? "No matches."
        : hits
            .map(
              (hit) =>
                `## ${hit.title} (${hit.id})\n${hit.snippet}\n\nUse steddy_get_topic with topic "${hit.id}" for full text.`,
            )
            .join("\n\n---\n\n");
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "steddy_list_topics",
  {
    description: "List all Steddy documentation topic ids and titles.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: DOC_ENTRIES.map((entry) => `- ${entry.id}: ${entry.title}`).join(
          "\n",
        ),
      },
    ],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
