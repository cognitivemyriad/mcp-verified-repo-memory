import { execSync } from "child_process";
import { createHash } from "crypto";
import { realpathSync } from "fs";
import { logDebug, logWarn } from "./util/logger.js";

export function getRepoRoot(providedPath: string): string {
    let resolvedPath = providedPath;
    try {
        resolvedPath = realpathSync(providedPath);
    } catch (e) {
        logWarn(`Could not resolve realpath for ${providedPath}, using as is.`);
    }

    try {
        const out = execSync("git rev-parse --show-toplevel", { cwd: resolvedPath, stdio: "pipe" });
        return realpathSync(out.toString().trim());
    } catch (e) {
        logDebug(`git rev-parse failed in ${resolvedPath}, falling back to provided path.`);
        return resolvedPath;
    }
}

export function getOriginUrl(repoRoot: string): string {
    try {
        const out = execSync("git remote get-url origin", { cwd: repoRoot, stdio: "pipe" });
        return out.toString().trim();
    } catch {
        return "";
    }
}

export function generateRepoFingerprint(repoRoot: string): string {
    const originUrl = getOriginUrl(repoRoot);
    const input = `${repoRoot}\n${originUrl}\n`;
    return createHash("sha256").update(input).digest("hex");
}
