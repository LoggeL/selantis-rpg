import type { Page } from '@playwright/test';

/** Keep browser regressions stable while another task edits the shared checkout. */
export async function disableReloads(page: Page): Promise<void> {
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: `
    const sheets = new Map();
    export function updateStyle(id, css) {
      let el = sheets.get(id);
      if (!el) { el = document.createElement('style'); document.head.appendChild(el); sheets.set(id, el); }
      el.textContent = css;
    }
    export function removeStyle(id) { sheets.get(id)?.remove(); sheets.delete(id); }
    export function injectQuery(url) { return url; }
    export function createHotContext() { return { data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, invalidate() {}, decline() {}, on() {}, off() {}, send() {} }; }
    export class ErrorOverlay {}
  ` }));
}
