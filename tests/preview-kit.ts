/// <reference lib="dom" />
// Helpers for the interaction tests of tree-like and scrolling previews.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from 'playwright';
import { openPreview, withBrowser, root } from './lib.ts';

interface TokenFile {
	color: { themes: Array<{ id: string }>; tokens: Array<{ name: string; value: string | Record<string, string> }> };
}

// The computed colour a token paints, written the way the browser reports it.
export function rgb(token: string): string {
	const file = JSON.parse(fs.readFileSync(path.join(root, 'tokens.json'), 'utf8')) as TokenFile;
	const theme = file.color.themes[0].id;
	let name = token;
	for (let hops = 0; hops < 8; hops++) {
		const entry = file.color.tokens.find((t) => t.name === name);
		assert.ok(entry, 'token ' + name);
		const raw = typeof entry.value === 'string' ? entry.value : entry.value[theme];
		const alias = /^\{(.+)\}$/.exec(raw);
		if (alias) {
			name = alias[1];
			continue;
		}
		const hex = /^#([0-9a-f]{6})$/i.exec(raw);
		assert.ok(hex, 'six digit hex for ' + name);
		const n = parseInt(hex[1], 16);
		return 'rgb(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')';
	}
	throw new Error('alias loop for ' + token);
}

// Opens a preview, runs the body, then requires a clean console.
export async function inPreview(name: string, body: (page: Page) => Promise<void>): Promise<void> {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, name);
		await body(page);
		assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
		await page.close();
	});
}

export const bgOf = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).backgroundColor);
export const colorOf = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).color);
export const classes = async (target: Locator): Promise<string[]> => ((await target.getAttribute('class')) ?? '').split(/\s+/);
export const widthOf = (target: Locator): Promise<number> => target.evaluate((el) => el.getBoundingClientRect().width);
export const settle = (page: Page): Promise<void> => page.waitForTimeout(80);
// Moves the pointer to the empty page margin, which takes the hover off any row.
export const parkPointer = (page: Page): Promise<void> => page.mouse.move(2, 2);

export const shown = (target: Locator): Promise<boolean> => target.isVisible();
export interface Box { x: number; y: number; width: number; height: number }
// The middle point of a bounding box.
export const centre = (b: Box | null): { x: number; y: number } => {
	assert.ok(b, 'bounding box');
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
export const clickBlank = (page: Page): Promise<void> => page.mouse.click(2, 2);
export const keys = (page: Page, ...keys: string[]): Promise<void> => keys.reduce((chain, key) => chain.then(() => page.keyboard.press(key)), Promise.resolve());
export const movePointer = (page: Page, x: number, y: number, steps = 1): Promise<void> => page.mouse.move(x, y, { steps });
export const holdPointer = (page: Page): Promise<void> => page.mouse.down();
export const releasePointer = (page: Page): Promise<void> => page.mouse.up();
export const spin = (page: Page, dx: number, dy: number): Promise<void> => page.mouse.wheel(dx, dy);

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The row inside `scope` whose label text is exactly `label`.
export function rowIn(page: Page, scope: string, rowClass: string, textClass: string, label: string): Locator {
	return page.locator(scope + ' ' + rowClass).filter({ has: page.locator(textClass, { hasText: new RegExp('^' + escapeRegExp(label) + '$') }) });
}

export const visibleLabels = (page: Page, scope: string, rowClass: string, textClass: string): Promise<string[]> =>
	page.$$eval(scope + ' ' + rowClass + ':not([hidden]) ' + textClass, (els) => els.map((el) => el.textContent ?? ''));
