/// <reference lib="dom" />
// The UeElement pinned rule: an element with data-pinned, or inside a data-pinned ancestor, shows its authored markup and runs no setup.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openPreview, withBrowser } from './lib.ts';

const TOGGLE = '<button class="button button--toggle" type="button" aria-pressed="false">Snap</button>';

test('UeElement: a pinned element runs no setup, keeps display: contents and ignores the pointer', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Button');
		await page.evaluate((toggle) => {
			const host = document.createElement('div');
			host.id = 'pin-probe';
			host.innerHTML = '<ue-button id="own" data-pinned>' + toggle + '</ue-button>'
				+ '<div data-pinned><ue-button id="inherited">' + toggle + '</ue-button></div>'
				+ '<ue-button id="live">' + toggle + '</ue-button>';
			document.body.prepend(host);
		}, TOGGLE);
		const pressed = (id: string): Promise<string | null> => page.locator('#' + id + ' .button').getAttribute('aria-pressed');
		for (const id of ['own', 'inherited', 'live']) await page.locator('#' + id + ' .button').evaluate((button) => (button as HTMLElement).click());
		assert.equal(await pressed('own'), 'false', 'data-pinned on the element');
		assert.equal(await pressed('inherited'), 'false', 'data-pinned on an ancestor');
		assert.equal(await pressed('live'), 'true', 'the live element toggles, so the probe can tell setup from no setup');
		for (const id of ['own', 'inherited', 'live']) assert.equal(await page.locator('#' + id).evaluate((el) => (el as HTMLElement).style.display), 'contents', id + ' is display: contents');
		assert.equal(await page.locator('#own .button').evaluate((el) => getComputedStyle(el).pointerEvents), 'none', 'pointer-events passes through the display: contents host');
		assert.equal(await page.locator('#inherited .button').evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
		assert.equal(await page.locator('#live .button').evaluate((el) => getComputedStyle(el).pointerEvents), 'auto');
		const hit = (id: string): Promise<boolean> => page.locator('#' + id + ' .button').evaluate((button) => {
			const box = button.getBoundingClientRect();
			return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === button;
		});
		assert.equal(await hit('own'), false, 'a pinned element is not under the pointer');
		assert.equal(await hit('inherited'), false);
		assert.equal(await hit('live'), true);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

test('UeElement: a pinned element with no markup does not fail, a live one fails loud', async () => {
	await withBrowser(async (browser) => {
		const { page } = await openPreview(browser, 'Button');
		const failures: string[] = [];
		page.on('pageerror', (e) => failures.push(String(e)));
		await page.evaluate(() => {
			const pinned = document.createElement('ue-button');
			pinned.setAttribute('data-pinned', '');
			document.body.append(pinned, document.createElement('ue-button'));
		});
		await page.waitForTimeout(100);
		assert.equal(failures.filter((f) => /ue-button needs a \.button element/.test(f)).length, 1, 'only the live empty element throws');
		await page.close();
	});
});
