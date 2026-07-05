import { FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';

/** Activate a focus trap on `element`; returns a disposer that restores focus. */
export function activateFocusTrap(
  factory: FocusTrapFactory,
  element: HTMLElement,
  restoreFocusTo?: HTMLElement | null,
): () => void {
  const trap = factory.create(element);
  trap.focusInitialElementWhenReady();
  return () => {
    trap.destroy();
    restoreFocusTo?.focus();
  };
}

export type { FocusTrap };
