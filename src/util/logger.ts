export function logDebug(...args: any[]) {
    if (process.env.DEBUG) {
        console.error("[DEBUG]", ...args);
    }
}

export function logInfo(...args: any[]) {
    console.error("[INFO]", ...args);
}

export function logWarn(...args: any[]) {
    console.error("[WARN]", ...args);
}

export function logError(...args: any[]) {
    console.error("[ERROR]", ...args);
}
