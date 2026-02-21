import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { Store } from "../storage/store.js";
import { Citation, Memory } from "../storage/types.js";
import { extractSnippetFromFile } from "../verify/extract.js";
import { normalizeSnippet, hashSnippet } from "../verify/normalize.js";
import { containsSecret } from "../util/secrets.js";
import { CITATION_MAX_LINES } from "../constants.js";
import { Config } from "../config.js";
import { McpError } from "../util/errors.js";

export function registerStoreTool(server: McpServer, store: Store, config: Config) {
    server.tool(
        "vrm_store",
        "Store a memory with file citations. Snippets are auto-extracted.",
        {
            subject: z.string().min(1).max(80),
            fact: z.string().min(1).max(800),
            reason: z.string().max(400).optional(),
            tags: z.array(z.string().min(1).max(30)).max(10).optional(),
            ttlDays: z.number().int().min(1).max(365).optional(),
            citations: z.array(
                z.object({
                    path: z.string(),
                    startLine: z.number().int().min(1),
                    endLine: z.number().int().min(1),
                    note: z.string().max(200).optional()
                })
            ).min(1).max(5)
        },
        async (args) => {
            try {
                const nowMs = Date.now();
                store.cleanupExpired(nowMs);

                if (config.secretScan) {
                    if (containsSecret(args.subject) || containsSecret(args.fact) || (args.reason && containsSecret(args.reason))) {
                        throw new McpError("Secret detected in input.");
                    }
                }

                const citations: Citation[] = [];
                for (const cit of args.citations) {
                    if (cit.endLine < cit.startLine) {
                        throw new McpError(`Invalid line range: ${cit.startLine}-${cit.endLine}`);
                    }
                    if (cit.endLine - cit.startLine + 1 > CITATION_MAX_LINES) {
                        throw new McpError(`Citation exceeds max lines (${CITATION_MAX_LINES})`);
                    }

                    const rawText = extractSnippetFromFile(config.repoRoot, cit.path, cit.startLine, cit.endLine, config.maxFileBytes);
                    if (config.secretScan && containsSecret(rawText)) {
                        throw new McpError(`Secret detected in snippet from ${cit.path}`);
                    }

                    const normalized = normalizeSnippet(rawText);
                    const sha256 = hashSnippet(normalized);

                    citations.push({
                        id: randomUUID(),
                        path: cit.path,
                        startLine: cit.startLine,
                        endLine: cit.endLine,
                        note: cit.note,
                        snippetText: rawText,
                        snippetSha256: sha256,
                        lastValidatedAt: new Date(nowMs).toISOString(),
                        lastValidationStatus: "VALID",
                        lastValidationDetail: null
                    });
                }

                const ttl = args.ttlDays ?? config.ttlDays;
                const expiresAtMs = nowMs + ttl * 24 * 60 * 60 * 1000;

                const memory: Memory = {
                    id: randomUUID(),
                    subject: args.subject,
                    fact: args.fact,
                    reason: args.reason,
                    tags: args.tags || [],
                    createdAt: new Date(nowMs).toISOString(),
                    updatedAt: new Date(nowMs).toISOString(),
                    lastUsedAt: null,
                    expiresAt: new Date(expiresAtMs).toISOString(),
                    citations
                };

                store.schema!.memories.push(memory);
                store.atomicWrite();

                const result = {
                    stored: true,
                    memoryId: memory.id,
                    expiresAt: memory.expiresAt,
                    citations: citations.map(c => ({
                        id: c.id,
                        path: c.path,
                        startLine: c.startLine,
                        endLine: c.endLine,
                        snippetSha256: c.snippetSha256,
                        snippetPreview: c.snippetText.substring(0, 200)
                    }))
                };

                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: JSON.stringify({ error: e.message, isError: true }, null, 2) }] };
            }
        }
    );
}
