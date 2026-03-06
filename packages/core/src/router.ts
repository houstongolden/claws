import type { MessageEvent, Mode, Router, RouterDecision, SessionKey, ViewStack } from "@claws/shared/types";

export interface StaticRouterConfig {
  workspaceId: string;
  defaultPrimaryView?: Mode;
  defaultOverlays?: Mode[];
}

const VIEW_AGENT_MAP: Record<Mode, string> = {
  founder: "founder",
  agency: "agency",
  developer: "developer",
  creator: "creator",
  personal: "personal",
  fitness: "fitness"
};

function makeThreadKey(event: MessageEvent): string {
  return [event.channel, event.chat.chatId, event.chat.threadId ?? "root"].join(":");
}

function inferPrimaryView(text: string | undefined, fallback: Mode): Mode {
  const input = (text ?? "").toLowerCase();

  if (/(code|bug|typescript|build|implement|dev)/.test(input)) return "developer";
  if (/(client|sales|agency|deliverable)/.test(input)) return "agency";
  if (/(content|post|article|write|creator)/.test(input)) return "creator";
  if (/(workout|nutrition|fitness|protein)/.test(input)) return "fitness";
  if (/(family|personal|calendar|home)/.test(input)) return "personal";

  return fallback;
}

function extractOverlayViews(text: string | undefined): Mode[] {
  const input = (text ?? "").toLowerCase();
  const overlays = new Set<Mode>();
  if (input.includes("founder")) overlays.add("founder");
  if (input.includes("agency")) overlays.add("agency");
  if (input.includes("developer") || input.includes("dev")) overlays.add("developer");
  if (input.includes("creator") || input.includes("content")) overlays.add("creator");
  if (input.includes("personal")) overlays.add("personal");
  if (input.includes("fitness")) overlays.add("fitness");
  return [...overlays];
}

export class StaticRouter implements Router {
  private readonly workspaceId: string;
  private readonly defaultPrimaryView: Mode;
  private readonly defaultOverlays: Mode[];
  private readonly threadViewState = new Map<string, ViewStack>();

  constructor(config: StaticRouterConfig) {
    this.workspaceId = config.workspaceId;
    this.defaultPrimaryView = config.defaultPrimaryView ?? "founder";
    this.defaultOverlays = config.defaultOverlays ?? [];
  }

  async route(event: MessageEvent): Promise<RouterDecision> {
    const threadKey = makeThreadKey(event);
    const stored = this.threadViewState.get(threadKey);
    const inferredPrimary = inferPrimaryView(event.text, this.defaultPrimaryView);
    const inferredOverlays = extractOverlayViews(event.text);
    const primary = stored?.primary ?? inferredPrimary;

    const overlays = [
      ...new Set([...(stored?.overlays ?? this.defaultOverlays), ...inferredOverlays.filter((v) => v !== primary)])
    ];

    const viewStack: ViewStack = { primary, overlays };
    const leadAgentId = VIEW_AGENT_MAP[primary] ?? "founder";

    const sessionKey: SessionKey = {
      workspaceId: this.workspaceId,
      agentId: leadAgentId,
      channel: event.channel,
      chatId: event.chat.chatId,
      threadId: event.chat.threadId
    };

    return { sessionKey, viewStack, leadAgentId };
  }

  async setThreadViewState(input: {
    channel: MessageEvent["channel"];
    chatId: string;
    threadId?: string;
    primary: Mode;
    overlays?: Mode[];
  }): Promise<void> {
    const key = [input.channel, input.chatId, input.threadId ?? "root"].join(":");
    this.threadViewState.set(key, {
      primary: input.primary,
      overlays: [...new Set((input.overlays ?? []).filter((v) => v !== input.primary))]
    });
  }

  async getThreadViewState(input: {
    channel: MessageEvent["channel"];
    chatId: string;
    threadId?: string;
  }): Promise<ViewStack | null> {
    const key = [input.channel, input.chatId, input.threadId ?? "root"].join(":");
    return this.threadViewState.get(key) ?? null;
  }
}
