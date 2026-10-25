/// <reference lib="dom" />
// Small page probes shared by the preview tests: computed styles, tokens, keys and the mouse.
import type { Locator, Page } from 'playwright';

export const CLEAR = 'rgba(0, 0, 0, 0)';

// Resolves a design token to the colour string the browser computes for it.
export const token = (page: Page, name: string): Promise<string> =>
	page.evaluate((n) => {
		const probe = document.createElement('div');
		probe.style.background = 'var(--' + n + ')';
		document.body.append(probe);
		const colour = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return colour;
	}, name);

export const prop = (target: Locator, name: string): Promise<string> => target.evaluate((el, n) => getComputedStyle(el).getPropertyValue(n), name);
export const fill = (target: Locator): Promise<string> => prop(target, 'background-color');
export const ink = (target: Locator): Promise<string> => prop(target, 'color');
export const hasClass = (target: Locator, name: string): Promise<boolean> => target.evaluate((el, n) => el.classList.contains(n), name);
export const texts = (page: Page, selector: string): Promise<string[]> => page.$$eval(selector, (els) => els.map((el) => el.textContent?.trim() ?? ''));
export const focusedText = (page: Page): Promise<string> => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
export const after = (target: Locator): Locator => target.locator('xpath=following-sibling::*[1]');
export const press = (page: Page, key: string): Promise<void> => page.keyboard.press(key);
export const hold = (page: Page): Promise<void> => page.mouse.down();
export const release = (page: Page): Promise<void> => page.mouse.up();
export const away = (page: Page): Promise<void> => page.mouse.move(900, 700);
export const clickAway = (page: Page): Promise<void> => page.mouse.click(900, 700);
