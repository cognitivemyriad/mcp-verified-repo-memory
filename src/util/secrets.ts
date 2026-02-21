export function containsSecret(text: string): boolean {
    const patterns = [
        /-----BEGIN PRIVATE KEY-----/,
        /-----BEGIN RSA PRIVATE KEY-----/,
        /-----BEGIN OPENSSH PRIVATE KEY-----/,
        /ghp_[0-9a-zA-Z]{36}/,
        /github_pat_[0-9a-zA-Z_]{82}/,
        /AKIA[0-9A-Z]{16}/,
        /xox[baprs]-[0-9a-zA-Z]{10,48}/, // slack
        /sk-[a-zA-Z0-9]{20,48}/ // generic secret keys
    ];
    return patterns.some(p => p.test(text));
}
