export type ValidationStatus = "VALID" | "RELOCATED" | "STALE" | "MISSING";

export interface Citation {
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    snippetSha256: string;
    snippetText: string;
    lastValidatedAt: string | null;
    lastValidationStatus: ValidationStatus | null;
    lastValidationDetail: string | null;
    note?: string;
}

export interface Memory {
    id: string;
    subject: string;
    fact: string;
    reason?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
    lastUsedAt: string | null;
    expiresAt: string;
    citations: Citation[];
}

export interface RepoMeta {
    root: string;
    fingerprint: string;
    createdAt: string;
}

export interface StorageSchema {
    schemaVersion: 1;
    repo: RepoMeta;
    memories: Memory[];
}
