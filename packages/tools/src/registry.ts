export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;
export type ToolEnvironment = "workspace" | "api" | "browser" | "sandbox" | "computer";

export interface ToolSpec {
  name: string;
  description: string;
  risk: "low" | "medium" | "high";
  environment: ToolEnvironment;
  handler: ToolHandler;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolSpec>();

  register(tool: ToolSpec): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolSpec | undefined {
    return this.tools.get(name);
  }

  listNames(): string[] {
    return [...this.tools.keys()];
  }

  async run(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" is not registered`);
    return tool.handler(args);
  }

  listSpecs(): Array<{ name: string; risk: string; environment: ToolEnvironment }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      risk: t.risk,
      environment: t.environment,
    }));
  }

  byEnvironment(): Record<ToolEnvironment, string[]> {
    const result: Record<string, string[]> = {};
    for (const spec of this.tools.values()) {
      const env = spec.environment;
      if (!result[env]) result[env] = [];
      result[env].push(spec.name);
    }
    return result as Record<ToolEnvironment, string[]>;
  }
}
