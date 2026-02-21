import { DEFAULT_TTL_DAYS, MAX_FILE_BYTES } from "./constants.js";

export interface Config {
    repoRoot: string;
    dataDir: string;
    ttlDays: number;
    maxFileBytes: number;
    secretScan: boolean;
}

export function parseConfig(args: string[], env: NodeJS.ProcessEnv): Config {
    let repoRoot = process.cwd();
    let dataDir = env.VRM_DATA_DIR ?? ""; // Derive later if empty or not provided
    let ttlDays = env.VRM_TTL_DAYS ? parseInt(env.VRM_TTL_DAYS, 10) : DEFAULT_TTL_DAYS;
    let maxFileBytes = env.VRM_MAX_FILE_BYTES ? parseInt(env.VRM_MAX_FILE_BYTES, 10) : MAX_FILE_BYTES;
    let secretScan = env.VRM_SECRET_SCAN !== "off";

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--repo" && i + 1 < args.length) {
            repoRoot = args[++i];
        } else if (arg === "--data-dir" && i + 1 < args.length) {
            dataDir = args[++i];
        } else if (arg === "--ttl-days" && i + 1 < args.length) {
            ttlDays = parseInt(args[++i], 10);
        } else if (arg === "--max-file-bytes" && i + 1 < args.length) {
            maxFileBytes = parseInt(args[++i], 10);
        } else if (arg === "--no-secret-scan") {
            secretScan = false;
        }
    }

    if (isNaN(ttlDays) || ttlDays < 1 || ttlDays > 365) {
        ttlDays = DEFAULT_TTL_DAYS;
    }
    if (isNaN(maxFileBytes) || maxFileBytes < 1) {
        maxFileBytes = MAX_FILE_BYTES;
    }

    return {
        repoRoot,
        dataDir,
        ttlDays,
        maxFileBytes,
        secretScan,
    };
}
