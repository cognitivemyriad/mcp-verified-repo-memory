import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Store } from "../storage/store.js";
import { Config } from "../config.js";

export function registerSearchTool(server: McpServer, store: Store, config: Config) {
    server.tool(
        "vrm_search",
        "Search for candidates (no JIT verification, fast).",
        {
            query: z.string().min(1).max(200),
            limit: z.number().int().min(1).max(50).optional().default(20),
            includeExpired: z.boolean().optional().default(false)
        },
        async (args) => {
            try {
                const nowMs = Date.now();
                const deletedExpired = store.cleanupExpired(nowMs);

                const tokens = args.query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

                let memories = store.schema!.memories;
                if (!args.includeExpired) {
                    memories = memories.filter(m => new Date(m.expiresAt).getTime() > nowMs);
                }

                const scored = memories.map(m => {
                    let score = 0;
                    const searchSpace = `${m.subject} ${m.fact} ${m.reason || ""} ${(m.tags || []).join(" ")}`.toLowerCase();
                    for (const token of tokens) {
                        if (searchSpace.includes(token)) score++;
                    }
                    return { memory: m, score };
                }).filter(m => m.score > 0);

                scored.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return new Date(b.memory.updatedAt).getTime() - new Date(a.memory.updatedAt).getTime();
                });

                const results = scored.slice(0, args.limit).map(s => ({
                    id: s.memory.id,
                    subject: s.memory.subject,
                    factPreview: s.memory.fact.substring(0, 100),
                    tags: s.memory.tags,
                    expiresAt: s.memory.expiresAt,
                    citationPaths: s.memory.citations.map(c => c.path)
                }));

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            query: args.query,
                            results,
                            stats: {
                                totalMemories: store.schema!.memories.length,
                                returned: results.length,
                                deletedExpired
                            }
                        }, null, 2)
                    }]
                };
            } catch (e: any) {
                return { content: [{ type: "text", text: JSON.stringify({ error: e.message, isError: true }, null, 2) }] };
            }
        }
    );
}
