export class McpError extends Error {
    public readonly isError = true;
    constructor(message: string) {
        super(message);
        this.name = "McpError";
    }
}
