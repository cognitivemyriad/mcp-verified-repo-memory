import { readFileSync, statSync, existsSync } from "fs";
import { join, normalize, isAbsolute, sep } from "path";
import { McpError } from "../util/errors.js";

function isSafePath(repoRoot: string, relativePath: string): boolean {
    if (isAbsolute(relativePath)) return false;

    const absPath = normalize(join(repoRoot, relativePath));
    const normalizedRepo = normalize(repoRoot);

    // Strict boundary check: absolute path must be the repo root exactly, or strictly within it (with trailing separator)
    if (absPath !== normalizedRepo && !absPath.startsWith(normalizedRepo + sep)) return false;

    const parts = relativePath.split(/[/\\]/);
    if (parts.includes(".git") || parts.includes(".verified-repo-memory")) return false;
    if (parts.some(p => p === "..")) return false;

    return true;
}

export function safeJoin(repoRoot: string, relativePath: string): string {
    if (!isSafePath(repoRoot, relativePath)) {
        throw new McpError("Unsafe path traversal detected or disallowed directory access.");
    }
    return normalize(join(repoRoot, relativePath));
}

export function extractSnippetFromFile(repoRoot: string, relativePath: string, startLine: number, endLine: number, maxFileBytes: number): string {
    const absPath = safeJoin(repoRoot, relativePath);

    if (!existsSync(absPath)) {
        throw new McpError(`File not found: ${relativePath}`);
    }

    const stats = statSync(absPath);
    if (stats.size > maxFileBytes) {
        throw new McpError(`File too large: ${relativePath} (${stats.size} bytes > ${maxFileBytes} bytes)`);
    }

    const content = readFileSync(absPath, "utf-8");
    const lines = content.split(/\r\n|\r|\n/);

    if (startLine < 1 || endLine < startLine) {
        throw new McpError("Invalid line range.");
    }

    const snippetLines = lines.slice(startLine - 1, endLine);
    if (snippetLines.length === 0 && startLine > lines.length) {
        throw new McpError("Line range out of bounds.");
    }

    return snippetLines.join("\n");
}
