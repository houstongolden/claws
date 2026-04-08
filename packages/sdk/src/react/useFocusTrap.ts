import { useEffect, useRef } from "react";
import { FocusTrap } from "../core/focus-trap";

export interface UseFocusTrapOptions {
  /** Called when Escape is pressed inside the trap */
  onEscape?: () => void;
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
  options?: UseFocusTrapOptions,
): React.RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const trapRef = useRef<FocusTrap | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (active) {
      const trap = new FocusTrap(el, { onEscape: options?.onEscape });
      trap.activate();
      trapRef.current = trap;

      return () => {
        trap.deactivate();
        trapRef.current = null;
      };
    } else {
      // Ensure any lingering trap is deactivated
      if (trapRef.current) {
        trapRef.current.deactivate();
        trapRef.current = null;
      }
    }
  }, [active, options?.onEscape]);

  return containerRef;
}
