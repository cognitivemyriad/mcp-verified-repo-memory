import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Store } from '../src/storage/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('TTL Management', () => {
    const repoRoot = join(__dirname, 'fixtures', 'ttl-repo');
    const dataDir = join(repoRoot, '.verified-repo-memory');

    beforeEach(() => {
        mkdirSync(dataDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(repoRoot, { recursive: true, force: true });
        vi.useRealTimers();
    });

    it('cleans up expired memories', () => {
        vi.useFakeTimers();
        const now = Date.now();

        const store = new Store(repoRoot, dataDir);
        store.load();

        store.schema!.memories.push({
            id: 'mem-1',
            subject: 'Valid Memory',
            fact: 'Still valid',
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
            lastUsedAt: null,
            expiresAt: new Date(now + 10000).toISOString(),
            citations: []
        });

        store.schema!.memories.push({
            id: 'mem-2',
            subject: 'Expired Memory',
            fact: 'Should format drive',
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
            lastUsedAt: null,
            expiresAt: new Date(now - 1000).toISOString(),
            citations: []
        });

        const deleted = store.cleanupExpired(now);

        expect(deleted).toBe(1);
        expect(store.schema!.memories.length).toBe(1);
        expect(store.schema!.memories[0].id).toBe('mem-1');
    });
});
