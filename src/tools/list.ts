import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Store } from "../storage/store.js";
import { Config } from "../config.js";
import { verifyMemory } from "../verify/jit.js";

export function registerListTool(server: McpServer, store: Store, config: Config) {
    server.tool(
        "vrm_list",
        "List memories by status.",
        {
            status: z.enum(["all", "valid", "stale", "missing"]).optional().default("all"),
            limit: z.number().int().min(1).max(200).optional().default(50),
            verify: z.boolean().optional().default(false)
        },
        async (args) => {
            try {
                const nowMs = Date.now();
                store.cleanupExpired(nowMs);

                let memories = [...store.schema!.memories];
                memories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                let results = [];
                let storeNeedsSave = false;

                for (let m of memories) {
                    if (results.length >= args.limit) break;

                    let memStatus = "VALID";
                    let memoryToReturn = m;

                    if (args.verify) {
                        const { memory: verifiedMem, status } = verifyMemory(m, config.repoRoot, config.maxFileBytes);
                        memStatus = status;
                        memoryToReturn = verifiedMem;

                        const index = store.schema!.memories.findIndex(sm => sm.id === verifiedMem.id);
                        if (index !== -1) {
                            store.schema!.memories[index] = verifiedMem;
                            storeNeedsSave = true;
                        }
                    } else {
                        for (const cit of m.citations) {
                            if (cit.lastValidationStatus === "MISSING") memStatus = "MISSING";
                            else if (cit.lastValidationStatus === "STALE" && memStatus !== "MISSING") memStatus = "STALE";
                        }
                    }

                    if (args.status === "all" || args.status.toUpperCase() === memStatus) {
                        results.push({
                            id: memoryToReturn.id,
                            subject: memoryToReturn.subject,
                            status: memStatus,
                            expiresAt: memoryToReturn.expiresAt,
                            updatedAt: memoryToReturn.updatedAt,
                            citations: memoryToReturn.citations.map(c => ({
                                path: c.path,
                                startLine: c.startLine,
                                endLine: c.endLine,
                                status: c.lastValidationStatus
                            }))
                        });
                    }
                }

                if (storeNeedsSave) {
                    store.atomicWrite();
                }

                return { content: [{ type: "text", text: JSON.stringify({ items: results }, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: JSON.stringify({ error: e.message, isError: true }, null, 2) }] };
            }
        }
    );
}
