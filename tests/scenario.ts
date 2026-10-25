// Declares one preview test: opens the preview, runs the body, then asserts the page raised no errors.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Page } from 'playwright';
import { openPreview, withBrowser } from './lib.ts';

export function scenario(name: string, component: string, body: (page: Page) => Promise<void>): void {
	test(name, () =>
		withBrowser(async (browser) => {
			const { page, errors } = await openPreview(browser, component);
			await body(page);
			assert.deepEqual(errors, [], 'the page raised console or page errors');
			await page.close();
		}),
	);
}
