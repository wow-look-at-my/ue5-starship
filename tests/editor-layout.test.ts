import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { openPreview, root, tokensCss, withBrowser } from './lib.ts';

const SHOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.build', 'editor-layout.png');
const TAGS = ['ue-menu-bar', 'ue-tool-bar', 'ue-tab-well', 'ue-place-actors-panel', 'ue-details-category', 'ue-scene-outliner', 'ue-content-browser', 'ue-status-bar'];

// The layout points at the uploaded asset; serve the file from disk in its place.
async function openLayout(browser: Parameters<Parameters<typeof withBrowser>[0]>[0]) {
	const png = fs.readFileSync(path.join(root, 'assets', 'Placeholders', 'viewport-placeholder.png'));
	const preview = await openPreview(browser, 'EditorLayout', { width: 1300, height: 960 });
	await preview.page.route('**/_blob/**', (route) => route.fulfill({ body: png, contentType: 'image/png' }));
	await preview.page.reload();
	await preview.page.addStyleTag({ content: tokensCss() });
	await preview.page.waitForTimeout(300);
	return preview;
}

test('the whole window renders, with every element defined and the viewport placeholder loaded', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openLayout(browser);
		for (const tag of TAGS) {
			assert.equal(await page.evaluate((t) => Boolean(customElements.get(t)), tag), true, tag + ' is defined');
		}
		assert.ok(await page.$eval('.el-viewport', (img) => (img as HTMLImageElement).naturalWidth > 0), 'viewport image loaded');
		fs.mkdirSync(path.dirname(SHOT), { recursive: true });
		await page.screenshot({ path: SHOT, fullPage: true });
		assert.deepEqual(errors.filter((e) => !/_blob/.test(e)), []);
	});
});

test('the menu bar opens a menu inside the composed window', async () => {
	await withBrowser(async (browser) => {
		const { page } = await openLayout(browser);
		const edit = page.locator('ue-menu-bar [role="menuitem"][aria-haspopup="menu"]').nth(1);
		await edit.click();
		assert.equal(await edit.getAttribute('aria-expanded'), 'true');
		await page.keyboard.press('Escape');
		assert.equal(await edit.getAttribute('aria-expanded'), 'false');
	});
});

test('selecting an outliner row updates its selection state', async () => {
	await withBrowser(async (browser) => {
		const { page } = await openLayout(browser);
		const rows = page.locator('ue-scene-outliner [role="treeitem"]:visible');
		const target = rows.nth(3);
		await target.click();
		assert.equal(await target.getAttribute('aria-selected'), 'true');
	});
});

test('typing in the content browser search changes the item count', async () => {
	await withBrowser(async (browser) => {
		const { page } = await openLayout(browser);
		const status = page.locator('ue-content-browser .ContentBrowser__status');
		const before = await status.innerText();
		await page.locator('ue-content-browser .ContentBrowser__input').fill('Mat');
		assert.notEqual(await status.innerText(), before);
	});
});

test('closing the Place Actors tab empties its well', async () => {
	await withBrowser(async (browser) => {
		const { page } = await openLayout(browser);
		const stack = page.locator('ue-tab-well').first();
		await stack.locator('.tabWell-tab').hover();
		await stack.locator('.tabWell-close').click();
		assert.equal(await stack.locator('.tabWell-tab').count(), 0);
	});
});
