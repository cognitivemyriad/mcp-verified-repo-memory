import { existsSync, statSync, readFileSync } from "fs";
import { Citation, ValidationStatus, Memory } from "../storage/types.js";
import { normalizeSnippet, hashSnippet } from "./normalize.js";
import { safeJoin } from "./extract.js";
import { logDebug } from "../util/logger.js";

export function verifyCitation(citation: Citation, repoRoot: string, maxFileBytes: number): Citation {
    const result: Citation = { ...citation, lastValidatedAt: new Date().toISOString() };
    let absPath: string;

    try {
        absPath = safeJoin(repoRoot, citation.path);
    } catch (e: any) {
        result.lastValidationStatus = "MISSING";
        result.lastValidationDetail = e.message;
        return result;
    }

    if (!existsSync(absPath)) {
        result.lastValidationStatus = "MISSING";
        result.lastValidationDetail = "File no longer exists.";
        return result;
    }

    const stats = statSync(absPath);
    if (stats.size > maxFileBytes) {
        result.lastValidationStatus = "MISSING";
        result.lastValidationDetail = "File too large for verification.";
        return result;
    }

    let content: string;
    try {
        content = readFileSync(absPath, "utf-8");
    } catch (e: any) {
        result.lastValidationStatus = "MISSING";
        result.lastValidationDetail = "Failed to read file.";
        return result;
    }

    const lines = content.split(/\r\n|\r|\n/);

    // 1. Determine if current range is valid
    if (citation.startLine >= 1 && citation.endLine <= lines.length) {
        const currentSnippet = lines.slice(citation.startLine - 1, citation.endLine).join("\n");
        const currentNormalized = normalizeSnippet(currentSnippet);
        const currentHash = hashSnippet(currentNormalized);

        if (currentHash === citation.snippetSha256) {
            result.lastValidationStatus = "VALID";
            result.lastValidationDetail = null;
            return result;
        }
    }

    //  Attempt RELOCATION
    let normalizedFullContent = normalizeSnippet(content);
    let normalizedTargetSnippet = normalizeSnippet(citation.snippetText);

    const targetForSearch = normalizedTargetSnippet.replace(/\n$/, "");

    const firstIndex = normalizedFullContent.indexOf(targetForSearch);
    if (firstIndex !== -1) {
        const lastIndex = normalizedFullContent.lastIndexOf(targetForSearch);
        if (firstIndex === lastIndex) {
            const prefix = normalizedFullContent.substring(0, firstIndex);
            const newStartLine = prefix.split("\n").length;
            const targetLinesCount = targetForSearch.split("\n").length;
            const newEndLine = newStartLine + targetLinesCount - 1;

            if (newStartLine >= 1 && newEndLine <= lines.length) {
                const newExtractedSnippet = lines.slice(newStartLine - 1, newEndLine).join("\n");
                const newNormalized = normalizeSnippet(newExtractedSnippet);
                const newHash = hashSnippet(newNormalized);

                if (newHash === citation.snippetSha256) {
                    logDebug(`Relocated citation in ${citation.path} from ${citation.startLine}-${citation.endLine} to ${newStartLine}-${newEndLine}`);
                    result.startLine = newStartLine;
                    result.endLine = newEndLine;
                    result.lastValidationStatus = "RELOCATED";
                    result.lastValidationDetail = "Position updated in file.";
                    return result;
                }
            }
        }
    }

    result.lastValidationStatus = "STALE";
    result.lastValidationDetail = "Content changed and cannot be safely relocated.";
    return result;
}

export function verifyMemory(memory: Memory, repoRoot: string, maxFileBytes: number): { memory: Memory, status: ValidationStatus } {
    const updatedMemory = { ...memory, citations: [] as Citation[] };
    let missingCount = 0;
    let staleCount = 0;

    let changed = false;

    for (const citation of memory.citations) {
        const verifiedCitation = verifyCitation(citation, repoRoot, maxFileBytes);
        updatedMemory.citations.push(verifiedCitation);

        if (verifiedCitation.lastValidationStatus === "MISSING") {
            missingCount++;
        } else if (verifiedCitation.lastValidationStatus === "STALE") {
            staleCount++;
        }

        if (
            citation.lastValidationStatus !== verifiedCitation.lastValidationStatus ||
            citation.startLine !== verifiedCitation.startLine ||
            citation.endLine !== verifiedCitation.endLine
        ) {
            changed = true;
        }
    }

    if (changed) {
        updatedMemory.updatedAt = new Date().toISOString();
    }

    let finalStatus: ValidationStatus = "VALID";
    if (missingCount > 0) {
        finalStatus = "MISSING";
    } else if (staleCount > 0) {
        finalStatus = "STALE";
    }

    return { memory: updatedMemory, status: finalStatus };
}
