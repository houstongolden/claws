import { useState, useCallback, useEffect, useRef } from "react";
import { useGatewayContext } from "./GatewayContext";
import { METHODS, EVENTS } from "../core/protocol";
import type {
  ChatMessage,
  ChatStreamDelta,
  ChatStreamEnd,
  ToolCallCard,
} from "../core/types";

export interface ChatSessionOptions {
  sessionKey: string;
  /** Number of history messages to load on mount */
  historyLimit?: number;
}

export interface ChatSessionState {
  messages: ChatMessage[];
  streaming: boolean;
  streamBuffer: string;
  loading: boolean;
  error: Error | null;
}

export function useChatSession({ sessionKey, historyLimit = 50 }: ChatSessionOptions) {
  const { client } = useGatewayContext();
  const [state, setState] = useState<ChatSessionState>({
    messages: [],
    streaming: false,
    streamBuffer: "",
    loading: true,
    error: null,
  });
  const abortRef = useRef(false);
  const streamMsgIdRef = useRef<string | null>(null);

  // Load history on mount
  useEffect(() => {
    let cancelled = false;

    client
      .send<ChatMessage[]>(METHODS.CHAT_HISTORY, {
        sessionKey,
        limit: historyLimit,
      })
      .then((messages) => {
        if (!cancelled) {
          setState((s) => ({ ...s, messages: messages ?? [], loading: false }));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, sessionKey, historyLimit]);

  // Subscribe to streaming events
  useEffect(() => {
    const unsub1 = client.subscribe(
      EVENTS.CHAT_STREAM_DELTA,
      (payload) => {
        const delta = payload as ChatStreamDelta;
        if (delta.sessionKey !== sessionKey) return;
        if (abortRef.current) return;

        streamMsgIdRef.current = delta.messageId;
        setState((s) => ({
          ...s,
          streaming: true,
          streamBuffer: s.streamBuffer + delta.delta,
        }));
      }
    );

    const unsub2 = client.subscribe(
      EVENTS.CHAT_STREAM_END,
      (payload) => {
        const end = payload as ChatStreamEnd;
        if (end.sessionKey !== sessionKey) return;

        streamMsgIdRef.current = null;
        setState((s) => ({
          ...s,
          streaming: false,
          streamBuffer: "",
          messages: [...s.messages, end.message],
        }));
      }
    );

    // Also listen for non-streaming chat messages
    const unsub3 = client.subscribe(
      EVENTS.CHAT_MESSAGE,
      (payload) => {
        const msg = payload as ChatMessage & { sessionKey?: string };
        if (msg.sessionKey && msg.sessionKey !== sessionKey) return;

        setState((s) => ({
          ...s,
          messages: [...s.messages, msg],
        }));
      }
    );

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [client, sessionKey]);

  /** Send a message */
  const sendMessage = useCallback(
    async (message: string) => {
      abortRef.current = false;

      // Add user message optimistically
      const userMsg: ChatMessage = {
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setState((s) => ({
        ...s,
        messages: [...s.messages, userMsg],
        error: null,
      }));

      try {
        await client.send(METHODS.CHAT_SEND, {
          sessionKey,
          message,
          deliver: true,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
    },
    [client, sessionKey]
  );

  /** Abort current streaming response */
  const abort = useCallback(() => {
    abortRef.current = true;
    setState((s) => ({
      ...s,
      streaming: false,
      streamBuffer: "",
    }));
  }, []);

  return {
    ...state,
    sendMessage,
    abort,
  };
}
