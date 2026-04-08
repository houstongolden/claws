import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GatewayClient } from "../core/gateway-client";
import { ToolsHttpClient } from "../core/tools-http";
import { ConfigClient } from "../core/config-client";
import type { ConnectionStatus, GatewayConfig } from "../core/types";

export interface GatewayContextValue {
  client: GatewayClient;
  toolsHttp: ToolsHttpClient;
  configClient: ConfigClient;
  status: ConnectionStatus;
  error: Error | null;
}

const GatewayCtx = createContext<GatewayContextValue | null>(null);

export interface GatewayProviderProps {
  /** Gateway config — changing url will reconnect */
  config: GatewayConfig;
  children: ReactNode;
}

export function GatewayProvider({ config, children }: GatewayProviderProps) {
  const clientRef = useRef<GatewayClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<Error | null>(null);

  // Create client on mount or when url changes
  const client = (() => {
    if (!clientRef.current || clientRef.current.getStatus() === "disconnected") {
      clientRef.current = new GatewayClient(config);
    }
    return clientRef.current;
  })();

  const toolsHttp = useRef(new ToolsHttpClient(config.url)).current;
  const configClient = useRef(new ConfigClient(client)).current;

  useEffect(() => {
    const gatewayClient = new GatewayClient(config);
    clientRef.current = gatewayClient;

    const unsub1 = gatewayClient.on("status:change", setStatus);
    const unsub2 = gatewayClient.on("error", setError);

    gatewayClient.connect();

    return () => {
      unsub1();
      unsub2();
      gatewayClient.disconnect();
    };
  }, [config.url]);

  const value: GatewayContextValue = {
    client: clientRef.current!,
    toolsHttp,
    configClient,
    status,
    error,
  };

  return <GatewayCtx.Provider value={value}>{children}</GatewayCtx.Provider>;
}

export function useGatewayContext(): GatewayContextValue {
  const ctx = useContext(GatewayCtx);
  if (!ctx) {
    throw new Error("useGatewayContext must be used within a <GatewayProvider />");
  }
  return ctx;
}
