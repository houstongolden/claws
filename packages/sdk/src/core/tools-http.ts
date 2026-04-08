/**
 * HTTP client for /tools/invoke endpoint.
 *
 * Used for tool calls that go over HTTP instead of WS
 * (e.g., file read/write, exec).
 */

export interface ToolInvokeRequest {
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolInvokeResponse {
  ok: boolean;
  output?: unknown;
  error?: string;
}

export class ToolsHttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Ensure no trailing slash, derive HTTP URL from WS URL
    this.baseUrl = baseUrl
      .replace(/\/$/, "")
      .replace(/^ws:/, "http:")
      .replace(/^wss:/, "https:");
  }

  /** Invoke a tool via HTTP POST */
  async invoke(request: ToolInvokeRequest): Promise<ToolInvokeResponse> {
    const response = await fetch(`${this.baseUrl}/tools/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return response.json();
  }

  /** Read a file via the tool layer */
  async readFile(path: string): Promise<string | null> {
    const result = await this.invoke({
      tool: "read",
      input: { path },
    });
    if (!result.ok) return null;
    return result.output as string;
  }

  /** Write a file via the tool layer */
  async writeFile(path: string, content: string): Promise<boolean> {
    const result = await this.invoke({
      tool: "write",
      input: { path, content },
    });
    return result.ok;
  }
}
