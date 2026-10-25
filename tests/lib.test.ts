import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openPreview, withBrowser, tokensCss } from './lib.ts';

test('tokensCss resolves aliases and the first theme', () => {
	const css = tokensCss();
	assert.match(css, /--primary: #0070e0;/);
	assert.match(css, /--select: var\(--primary\);/);
});

test('a preview opens without console errors', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Cover');
		assert.equal(await page.locator('svg.cover').count(), 1);
		assert.deepEqual(errors, []);
		await page.close();
	});
});
