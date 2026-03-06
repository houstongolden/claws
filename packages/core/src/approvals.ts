import type { ApprovalItem, ToolRisk } from "@claws/shared/types";

type ResolveInput = {
  requestId: string;
  decision: "approved" | "denied";
  note?: string;
  grant?: {
    expiresAt?: number;
    scope:
      | { type: "once"; toolName: string }
      | { type: "tool"; toolName: string }
      | { type: "agent"; agentId: string }
      | { type: "view"; view: string }
      | {
          type: "session";
          sessionKey: {
            workspaceId: string;
            agentId: string;
            channel: string;
            chatId: string;
            threadId?: string;
          };
        };
    note?: string;
  };
};

export class ApprovalStore {
  private readonly pending = new Map<string, ApprovalItem>();
  private readonly grants = new Map<string, { expiresAt?: number; note?: string }>();

  private sessionGrantKey(input: {
    workspaceId: string;
    agentId: string;
    channel: string;
    chatId: string;
    threadId?: string;
  }): string {
    return `session:${input.workspaceId}:${input.agentId}:${input.channel}:${input.chatId}:${input.threadId ?? "root"}`;
  }

  hydrate(item: ApprovalItem): void {
    this.pending.set(item.id, item);
  }

  hydrateGrant(key: string, opts: { expiresAt?: number; note?: string }): void {
    this.grants.set(key, { expiresAt: opts.expiresAt, note: opts.note });
  }

  enqueue(input: {
    agentId: string;
    toolName: string;
    risk: ToolRisk;
    args?: Record<string, unknown>;
    reason?: string;
    environment?: ApprovalItem["environment"];
  }): ApprovalItem {
    const normalizedArgs = JSON.stringify(input.args ?? {});
    const duplicate = [...this.pending.values()].find(
      (item) =>
        item.agentId === input.agentId &&
        item.toolName === input.toolName &&
        item.risk === input.risk &&
        JSON.stringify(item.args ?? {}) === normalizedArgs
    );
    if (duplicate) return duplicate;

    const item: ApprovalItem = {
      id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      agentId: input.agentId,
      toolName: input.toolName,
      risk: input.risk,
      args: input.args ?? {},
      reason: input.reason,
      environment: input.environment ?? "workspace"
    };

    this.pending.set(item.id, item);
    return item;
  }

  listPending(): ApprovalItem[] {
    return [...this.pending.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  hasPending(): boolean {
    return this.pending.size > 0;
  }

  reset(): void {
    this.pending.clear();
    this.grants.clear();
  }

  async resolveDecision(input: ResolveInput): Promise<{ requestId: string; decision: string }> {
    const target = this.pending.get(input.requestId);
    if (!target) {
      throw new Error("Approval request not found");
    }

    this.pending.delete(input.requestId);

    if (input.decision === "approved" && input.grant) {
      const scope = input.grant.scope;
      if (scope.type === "tool") {
        this.grants.set(`tool:${scope.toolName}`, {
          expiresAt: input.grant.expiresAt,
          note: input.grant.note
        });
      }
      if (scope.type === "once") {
        this.grants.set(`once:${scope.toolName}`, {
          expiresAt: input.grant.expiresAt,
          note: input.grant.note
        });
      }
      if (scope.type === "agent") {
        this.grants.set(`agent:${scope.agentId}`, {
          expiresAt: input.grant.expiresAt,
          note: input.grant.note
        });
      }
      if (scope.type === "session") {
        const key = this.sessionGrantKey(scope.sessionKey);
        this.grants.set(key, {
          expiresAt: input.grant.expiresAt,
          note: input.grant.note
        });
      }
      if (scope.type === "view") {
        this.grants.set(`view:${scope.view}`, {
          expiresAt: input.grant.expiresAt,
          note: input.grant.note
        });
      }
    }

    return { requestId: input.requestId, decision: input.decision };
  }

  isToolGranted(toolName: string): boolean {
    const grant = this.grants.get(`tool:${toolName}`);
    if (!grant) return false;
    if (grant.expiresAt && grant.expiresAt < Date.now()) {
      this.grants.delete(`tool:${toolName}`);
      return false;
    }
    return true;
  }

  isGranted(input: {
    toolName: string;
    agentId: string;
    view?: string;
    sessionKey?: {
      workspaceId: string;
      agentId: string;
      channel: string;
      chatId: string;
      threadId?: string;
    };
  }): boolean {
    const now = Date.now();
    const onceKey = `once:${input.toolName}`;
    const onceGrant = this.grants.get(onceKey);
    if (onceGrant) {
      if (!onceGrant.expiresAt || onceGrant.expiresAt >= now) {
        // one-time grants are consumed on first successful check
        this.grants.delete(onceKey);
        return true;
      }
      this.grants.delete(onceKey);
    }

    const keys = [
      `tool:${input.toolName}`,
      `agent:${input.agentId}`,
      input.view ? `view:${input.view}` : null,
      input.sessionKey ? this.sessionGrantKey(input.sessionKey) : null
    ].filter((key): key is string => Boolean(key));

    for (const key of keys) {
      const grant = this.grants.get(key);
      if (!grant) continue;
      if (grant.expiresAt && grant.expiresAt < now) {
        this.grants.delete(key);
        continue;
      }
      return true;
    }

    return false;
  }
}
