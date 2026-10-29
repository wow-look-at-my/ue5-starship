/// <reference lib="dom" />
// A pinned specimen has pointer-events: none (src/_shared/base.css), so
// Playwright refuses to hover or click it.
import assert from 'node:assert/strict';
import type { Locator, Page } from 'playwright';

async function centreOf(target: Locator): Promise<{ x: number; y: number }> {
	const box = await target.boundingBox();
	assert.ok(box, 'a pinned specimen has a box');
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Moves the real pointer over the middle of the specimen.
export async function hoverAt(page: Page, target: Locator): Promise<void> {
	const at = await centreOf(target);
	await page.mouse.move(at.x, at.y);
}

// Clicks the real pointer on the middle of the specimen.
export async function clickAt(page: Page, target: Locator): Promise<void> {
	const at = await centreOf(target);
	await page.mouse.click(at.x, at.y);
}

// The specimen must ignore the pointer, or the other pinned checks prove nothing.
export async function assertInert(target: Locator): Promise<void> {
	assert.equal(await target.evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
}
