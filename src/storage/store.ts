import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { StorageSchema } from "./types.js";
import { generateRepoFingerprint } from "../repo.js";
import { logDebug, logError } from "../util/logger.js";
import { McpError } from "../util/errors.js";

export class Store {
    private memFile: string;
    private tmpFile: string;
    private bakFile: string;
    private metaFile: string;

    public schema: StorageSchema | null = null;
    private isLoaded = false;

    constructor(
        private readonly repoRoot: string,
        private readonly dataDir: string
    ) {
        if (!existsSync(this.dataDir)) {
            mkdirSync(this.dataDir, { recursive: true });
        }
        this.memFile = join(this.dataDir, "memories.json");
        this.tmpFile = join(this.dataDir, "memories.json.tmp");
        this.bakFile = join(this.dataDir, "memories.json.bak");
        this.metaFile = join(this.dataDir, "meta.json");
    }

    public load(): void {
        if (this.isLoaded) return;

        const currentFingerprint = generateRepoFingerprint(this.repoRoot);

        if (existsSync(this.metaFile)) {
            const metaStr = readFileSync(this.metaFile, "utf-8");
            const meta = JSON.parse(metaStr);
            if (meta.fingerprint !== currentFingerprint) {
                throw new McpError(`Repo fingerprint mismatch! Expected: ${meta.fingerprint}, Actual: ${currentFingerprint}`);
            }
        } else {
            const meta = {
                root: this.repoRoot,
                fingerprint: currentFingerprint,
                createdAt: new Date().toISOString()
            };
            writeFileSync(this.metaFile, JSON.stringify(meta, null, 2));
        }

        if (existsSync(this.memFile)) {
            const memStr = readFileSync(this.memFile, "utf-8");
            this.schema = JSON.parse(memStr) as StorageSchema;
        } else {
            this.schema = {
                schemaVersion: 1,
                repo: {
                    root: this.repoRoot,
                    fingerprint: currentFingerprint,
                    createdAt: new Date().toISOString()
                },
                memories: []
            };
            this.atomicWrite();
        }
        this.isLoaded = true;
    }

    public atomicWrite(): void {
        if (!this.schema) return;
        try {
            const data = JSON.stringify(this.schema, null, 2);
            writeFileSync(this.tmpFile, data);

            if (existsSync(this.memFile)) {
                if (existsSync(this.bakFile)) {
                    unlinkSync(this.bakFile); // Prevent Windows EXDEV or EPERM on existing dest
                }
                renameSync(this.memFile, this.bakFile);
            }
            renameSync(this.tmpFile, this.memFile);
        } catch (e) {
            logError("Failed to perform atomic write:", e);
            throw new McpError("Failed to save memories");
        }
    }

    public cleanupExpired(nowMs: number): number {
        if (!this.schema) return 0;

        const initialCount = this.schema.memories.length;
        this.schema.memories = this.schema.memories.filter(m => {
            const expires = new Date(m.expiresAt).getTime();
            return expires > nowMs;
        });

        const deletedCount = initialCount - this.schema.memories.length;
        if (deletedCount > 0) {
            this.atomicWrite();
            logDebug(`Cleaned up ${deletedCount} expired memories.`);
        }
        return deletedCount;
    }
}
