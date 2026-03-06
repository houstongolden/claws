/**
 * Thrown when a file operation is blocked by FOLDER.md policy.
 * Gateway can catch this and emit a trace event.
 */
export class FolderPolicyError extends Error {
  constructor(
    message: string,
    public readonly code: "not-allowed" | "read-only" | "append-only" | "locked",
    public readonly path: string,
    public readonly root: string
  ) {
    super(message);
    this.name = "FolderPolicyError";
    Object.setPrototypeOf(this, FolderPolicyError.prototype);
  }
}
