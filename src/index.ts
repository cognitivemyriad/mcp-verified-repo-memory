#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseConfig } from "./config.js";
import { getRepoRoot } from "./repo.js";
import { Store } from "./storage/store.js";
import { registerStoreTool } from "./tools/store.js";
import { registerSearchTool } from "./tools/search.js";
import { registerRetrieveTool } from "./tools/retrieve.js";
import { registerListTool } from "./tools/list.js";
import { registerForgetTool } from "./tools/forget.js";
import { MCP_SERVER_NAME, SERVER_TITLE } from "./constants.js";
import { join } from "path";
import { logError } from "./util/logger.js";

async function main() {
    const config = parseConfig(process.argv.slice(2), process.env);
    config.repoRoot = getRepoRoot(config.repoRoot);

    if (!config.dataDir) {
        config.dataDir = join(config.repoRoot, ".verified-repo-memory");
    }

    const store = new Store(config.repoRoot, config.dataDir);
    store.load();

    const server = new McpServer({
        name: MCP_SERVER_NAME,
        version: "0.1.0",
    });

    registerStoreTool(server, store, config);
    registerSearchTool(server, store, config);
    registerRetrieveTool(server, store, config);
    registerListTool(server, store, config);
    registerForgetTool(server, store);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error(`${SERVER_TITLE} running on stdio for repo: ${config.repoRoot}`);
}

main().catch((e) => {
    logError("Fatal:", e);
    process.exit(1);
});
