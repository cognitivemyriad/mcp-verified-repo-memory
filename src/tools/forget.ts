import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Store } from "../storage/store.js";

export function registerForgetTool(server: McpServer, store: Store) {
    server.tool(
        "vrm_forget",
        "Manually delete a memory by ID.",
        {
            memoryId: z.string().uuid(),
            hardDelete: z.boolean().optional().default(true)
        },
        async (args) => {
            try {
                const initialCount = store.schema!.memories.length;

                store.schema!.memories = store.schema!.memories.filter(m => m.id !== args.memoryId);

                const deleted = store.schema!.memories.length < initialCount;

                if (deleted) {
                    store.atomicWrite();
                }

                return { content: [{ type: "text", text: JSON.stringify({ deleted, memoryId: args.memoryId }, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: JSON.stringify({ error: e.message, isError: true }, null, 2) }] };
            }
        }
    );
}
