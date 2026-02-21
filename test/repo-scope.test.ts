import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Store } from '../src/storage/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Repository Scoping', () => {
    const baseDir = join(__dirname, 'fixtures', 'scope-test');
    const repoA = join(baseDir, 'repoA');
    const repoB = join(baseDir, 'repoB');
    const dataDirA = join(repoA, '.verified-repo-memory');
    const dataDirB = join(repoB, '.verified-repo-memory');

    beforeEach(() => {
        mkdirSync(dataDirA, { recursive: true });
        mkdirSync(dataDirB, { recursive: true });
    });

    afterEach(() => {
        rmSync(baseDir, { recursive: true, force: true });
    });

    it('fails to load when repo fingerprint mismatches', () => {
        const storeA = new Store(repoA, dataDirA);
        storeA.load(); // initializes meta.json

        // Now try to load storeB using dataDirA (simulating wrong access)
        // we expect it to throw due to fingerprint mismatch
        const storeBMismatch = new Store(repoB, dataDirA);
        expect(() => storeBMismatch.load()).toThrowError(/Repo fingerprint mismatch/);
    });
});
