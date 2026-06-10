/**
 * Angular Elements registration.
 * Call registerInteropElements() from main.ts or a lazy-loaded module
 * to expose these components as standard web custom elements.
 *
 * Registered tags:
 *   <interop-icon>           — SVG icon sprite
 *   <interop-entry-card>     — Registry entry card (grid/list)
 *   <interop-sensitivity-badge> — Data classification badge
 *   <interop-verified-mark>  — Verified publisher seal
 *   <interop-sparkline>      — Install-trend sparkline
 */

import { ApplicationRef, createComponent, EnvironmentInjector, inject, Injector } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { IconComponent } from './components/icon/icon.component';
import { EntryCardComponent } from './components/entry-card/entry-card.component';
import { SensitivityBadgeComponent } from './components/sensitivity-badge/sensitivity-badge.component';
import { VerifiedMarkComponent } from './components/verified-mark/verified-mark.component';
import { SparklineComponent } from './components/sparkline/sparkline.component';

let registered = false;

export function registerInteropElements(injector: Injector): void {
  if (registered || typeof customElements === 'undefined') return;
  registered = true;

  const define = (tag: string, component: Parameters<typeof createCustomElement>[0]) => {
    if (!customElements.get(tag)) {
      const el = createCustomElement(component, { injector });
      customElements.define(tag, el);
    }
  };

  define('interop-icon', IconComponent);
  define('interop-entry-card', EntryCardComponent);
  define('interop-sensitivity-badge', SensitivityBadgeComponent);
  define('interop-verified-mark', VerifiedMarkComponent);
  define('interop-sparkline', SparklineComponent);
}
