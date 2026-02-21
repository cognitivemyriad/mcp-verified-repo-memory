import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Store } from "../storage/store.js";
import { Config } from "../config.js";
import { verifyMemory } from "../verify/jit.js";

export function registerRetrieveTool(server: McpServer, store: Store, config: Config) {
    server.tool(
        "vrm_retrieve",
        "JIT-verify candidates and return valid memories.",
        {
            query: z.string().min(1).max(200),
            limit: z.number().int().min(1).max(20).optional().default(5),
            includeStale: z.boolean().optional().default(false),
            touch: z.boolean().optional().default(true)
        },
        async (args) => {
            try {
                const startMs = Date.now();
                const deletedExpired = store.cleanupExpired(startMs);

                const tokens = args.query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
                const memories = store.schema!.memories;

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

                const candidateLimit = args.limit * 5;
                const candidates = scored.slice(0, candidateLimit).map(s => s.memory);

                const valid = [];
                const stale = [];
                const missing = [];

                let validCount = 0;
                let relocatedCount = 0;
                let staleCount = 0;
                let missingCount = 0;

                let storeNeedsSave = false;

                for (const candidate of candidates) {
                    const { memory: updatedMemory, status } = verifyMemory(candidate, config.repoRoot, config.maxFileBytes);

                    const index = store.schema!.memories.findIndex(m => m.id === updatedMemory.id);
                    if (index !== -1) {
                        store.schema!.memories[index] = updatedMemory;
                        storeNeedsSave = true;
                    }

                    const isRelocated = updatedMemory.citations.some(c => c.lastValidationStatus === "RELOCATED");
                    if (isRelocated) relocatedCount++;

                    const outMemory = {
                        id: updatedMemory.id,
                        subject: updatedMemory.subject,
                        fact: updatedMemory.fact,
                        reason: updatedMemory.reason,
                        tags: updatedMemory.tags,
                        expiresAt: updatedMemory.expiresAt,
                        citations: updatedMemory.citations.map(c => ({
                            path: c.path,
                            startLine: c.startLine,
                            endLine: c.endLine,
                            status: c.lastValidationStatus,
                            snippetPreview: c.snippetText.substring(0, 200)
                        }))
                    };

                    if (status === "VALID") {
                        if (args.touch) {
                            const now = Date.now();
                            const newExpiresAt = new Date(now + config.ttlDays * 24 * 60 * 60 * 1000).toISOString();
                            updatedMemory.expiresAt = newExpiresAt;
                            updatedMemory.lastUsedAt = new Date(now).toISOString();
                            outMemory.expiresAt = newExpiresAt;
                            storeNeedsSave = true;
                        }
                        valid.push(outMemory);
                        validCount++;
                        if (valid.length >= args.limit) break;
                    } else if (status === "STALE") {
                        stale.push(outMemory);
                        staleCount++;
                    } else {
                        missing.push(outMemory);
                        missingCount++;
                    }
                }

                if (storeNeedsSave) {
                    store.atomicWrite();
                }

                const tookMs = Date.now() - startMs;

                const result: any = {
                    query: args.query,
                    valid,
                    stats: {
                        candidates: candidates.length,
                        verified: candidates.length,
                        validCount,
                        relocatedCount,
                        staleCount,
                        missingCount,
                        deletedExpired,
                        tookMs
                    }
                };

                if (args.includeStale) {
                    result.stale = stale;
                    result.missing = missing;
                }

                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: JSON.stringify({ error: e.message, isError: true }, null, 2) }] };
            }
        }
    );
}
