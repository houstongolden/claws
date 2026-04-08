// ── FocusTrap — framework-agnostic keyboard focus trapping ───────────────────

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export interface FocusTrapOptions {
  /** Called when Escape is pressed inside the trap */
  onEscape?: () => void;
  /** Element to focus when the trap activates */
  initialFocus?: HTMLElement;
}

export class FocusTrap {
  private container: HTMLElement;
  private onEscape?: () => void;
  private initialFocus?: HTMLElement;
  private previouslyFocused: Element | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, options?: FocusTrapOptions) {
    this.container = container;
    this.onEscape = options?.onEscape;
    this.initialFocus = options?.initialFocus;
  }

  activate(): void {
    this.previouslyFocused = document.activeElement;

    this.boundKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    document.addEventListener("keydown", this.boundKeyDown, true);

    // Focus initial element or first focusable
    const target = this.initialFocus ?? this.getFocusables()[0];
    if (target) {
      requestAnimationFrame(() => target.focus());
    }
  }

  deactivate(): void {
    if (this.boundKeyDown) {
      document.removeEventListener("keydown", this.boundKeyDown, true);
      this.boundKeyDown = null;
    }

    // Restore focus
    if (
      this.previouslyFocused &&
      this.previouslyFocused instanceof HTMLElement
    ) {
      this.previouslyFocused.focus();
    }
    this.previouslyFocused = null;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private getFocusables(): HTMLElement[] {
    return Array.from(
      this.container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(
      (el) => el.offsetParent !== null, // visible check
    );
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      this.onEscape?.();
      return;
    }

    if (e.key !== "Tab") return;

    const focusables = this.getFocusables();
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}
