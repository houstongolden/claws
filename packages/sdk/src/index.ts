// @claws/sdk — Core exports (framework-agnostic)

export { GatewayClient } from "./core/gateway-client";
export { TypedEventEmitter } from "./core/event-emitter";
export { ReconnectController } from "./core/reconnect";
export { PairingController } from "./core/pairing";
export { ConfigClient } from "./core/config-client";
export { ToolsHttpClient } from "./core/tools-http";
export { SmartPollController } from "./core/smart-poll";
export { FocusTrap } from "./core/focus-trap";
export { getDeviceId, signChallenge, isSecureContext } from "./core/auth";
export { METHODS, EVENTS, PROTOCOL_VERSION } from "./core/protocol";

// Protocol schemas
export {
  RpcRequestSchema,
  RpcResponseSchema,
  GatewayEventSchema,
  GatewayMessageSchema,
  ConnectParamsSchema,
  ChatSendParamsSchema,
  ChatHistoryParamsSchema,
  CronCreateParamsSchema,
  CronUpdateParamsSchema,
  CronDeleteParamsSchema,
  ConfigGetParamsSchema,
  ConfigSetParamsSchema,
  SkillsToggleParamsSchema,
  ExecApproveParamsSchema,
  ExecDenyParamsSchema,
  AcpSpawnParamsSchema,
  AcpSteerParamsSchema,
  AcpCancelParamsSchema,
} from "./core/protocol";

// Types
export type {
  ConnectionStatus,
  ClientInfo,
  GatewayConfig,
  RpcRequest,
  RpcResponse,
  GatewayEvent,
  GatewayMessage,
  GatewayClientEvents,
  ChatRole,
  ChatMessage,
  ToolCallCard,
  ChatStreamDelta,
  ChatStreamEnd,
  CronJob,
  CronRunEvent,
  ChannelStatus,
  ExecApprovalRequest,
  NodeInfo,
  SessionInfo,
  ToolDefinition,
  SkillInfo,
  ConfigValue,
  ConfigSchema,
  PresenceInfo,
  AcpSessionState,
  AcpSession,
} from "./core/types";

export type { ReconnectConfig } from "./core/reconnect";
export type { PairingState } from "./core/pairing";
export type { ToolInvokeRequest, ToolInvokeResponse } from "./core/tools-http";
export type { SmartPollOptions } from "./core/smart-poll";
export type { FocusTrapOptions } from "./core/focus-trap";
