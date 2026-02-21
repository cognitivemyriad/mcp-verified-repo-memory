import { createHash } from "crypto";

export function normalizeSnippet(text: string): string {
    // 1. Convert all \r\n or \r to \n
    let normalized = text.replace(/\r\n|\r/g, "\n");

    // 2. Remove trailing whitespace from each line
    normalized = normalized.split("\n").map(line => line.replace(/[ \t]+$/, "")).join("\n");

    // 3. Ensure exactly one trailing newline (unless empty)
    if (normalized.length > 0) {
        normalized = normalized.replace(/\n+$/, "") + "\n";
    }

    return normalized;
}

export function hashSnippet(normalizedText: string): string {
    return createHash("sha256").update(normalizedText).digest("hex");
}
