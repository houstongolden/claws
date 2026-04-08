import { useEffect, useRef, useState, useCallback } from "react";
import { SmartPollController } from "../core/smart-poll";

export interface UseSmartPollOptions {
  /** Polling interval in ms */
  interval: number;
  /** Enable or disable polling (default true) */
  enabled?: boolean;
  /** Pause when document is hidden (default true) */
  pauseOnHidden?: boolean;
}

export interface UseSmartPollReturn {
  /** Trigger an immediate poll */
  fire: () => void;
  /** Whether polling is currently paused */
  paused: boolean;
}

export function useSmartPoll(
  callback: () => Promise<void>,
  options: UseSmartPollOptions,
): UseSmartPollReturn {
  const { interval, enabled = true, pauseOnHidden = true } = options;
  const controllerRef = useRef<SmartPollController | null>(null);
  const callbackRef = useRef(callback);
  const [paused, setPaused] = useState(false);

  // Keep callback ref fresh without restarting the controller
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.stop();
      controllerRef.current = null;
      return;
    }

    const controller = new SmartPollController(
      () => callbackRef.current(),
      { interval, pauseOnHidden },
    );
    controllerRef.current = controller;
    controller.start();

    // Sync paused state periodically via visibility change
    const syncPaused = () => setPaused(controller.isPaused);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", syncPaused);
    }

    return () => {
      controller.stop();
      controllerRef.current = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", syncPaused);
      }
    };
  }, [interval, enabled, pauseOnHidden]);

  const fire = useCallback(() => {
    controllerRef.current?.fire();
  }, []);

  return { fire, paused };
}
