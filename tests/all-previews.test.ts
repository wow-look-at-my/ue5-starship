import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { openPreview, root, serve, withBrowser } from './lib.ts';

const components = path.join(root, 'components');
const names = fs.readdirSync(components, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(components, e.name, 'preview.html'))).map((e) => e.name).sort();
const STATIC = new Set<string>();

test('every component folder is covered by this check', () => {
	assert.ok(names.length >= 36, 'found ' + names.length + ' previews');
});

for (const name of names.filter((n) => !STATIC.has(n))) {
	test(name + ': the preview carries no script, the bundle supplies every element', () => {
		const html = fs.readFileSync(path.join(components, name, 'preview.html'), 'utf8');
		assert.doesNotMatch(html, /<script/i, 'script tag');
	});

	test(name + ': at least one live custom element is defined and upgraded', async () => {
		await withBrowser(async (browser) => {
			const { page, errors } = await openPreview(browser, name);
			const report = await page.evaluate(() => {
				const tags = Array.from(new Set(Array.from(document.querySelectorAll('*')).map((el) => el.localName).filter((tag) => tag.startsWith('ue-'))));
				return tags.map((tag) => ({ tag, defined: Boolean(customElements.get(tag)), upgraded: document.querySelectorAll(tag + ':not(:defined)').length === 0 }));
			});
			assert.ok(report.length > 0, 'a ue-* element in the page');
			for (const entry of report) assert.deepEqual(entry, { tag: entry.tag, defined: true, upgraded: true });
			assert.deepEqual(errors, []);
			await page.close();
		});
	});
}

const kebab = (name: string): string => 'ue-' + name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

for (const name of names.filter((n) => fs.existsSync(path.join(components, n, n + '.js')))) {
	test(name + ': the standalone ES module defines the element and sets up every instance', { skip: Boolean(process.env.UE_PUBLISHED) }, async () => {
		await withBrowser(async (browser) => {
			const page = await browser.newPage();
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(String(e)));
			await page.goto((await serve()) + '/components/' + name + '/preview.html');
			await page.addScriptTag({ type: 'module', url: '/components/' + name + '/' + name + '.js' });
			const tag = kebab(name);
			await page.waitForFunction((t) => customElements.get(t) !== undefined, tag, { timeout: 5000 });
			const report = await page.evaluate((t) => {
				const els = Array.from(document.querySelectorAll(t));
				return { count: els.length, ready: els.filter((el) => (el as HTMLElement).style.display === 'contents').length };
			}, tag);
			assert.ok(report.count > 0, 'a ' + tag + ' in the preview');
			assert.equal(report.ready, report.count, 'every ' + tag + ' ran setup');
			assert.deepEqual(errors, []);
			await page.close();
		});
	});
}

test('Cover: every colour strip carries its token name as a tooltip', async () => {
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Cover');
		const titles = await page.$$eval('ue-cover rect.tile > title', (els) => els.map((el) => el.textContent));
		assert.deepEqual(titles, ['primary', 'panel', 'select-inactive', 'accent-folder', 'accent-green', 'header']);
		assert.deepEqual(errors, []);
		await page.close();
	});
});

// The design system page marks every preview static with "components/bundle.js is missing" when no bundle exists. The page preloads it into each preview.
test('components/bundle.js exists, is a classic script, and defines every ue-* element the previews use', async () => {
	const bundle = path.join(components, 'bundle.js');
	assert.ok(fs.existsSync(bundle), 'components/bundle.js exists');
	const source = fs.readFileSync(bundle, 'utf8');
	assert.match(source.split('\n')[0], /^\/\* @ds-bundle: \{"format":4,"namespace":"UEStarship"/);
	assert.doesNotMatch(source, /\bimport\b|<\/script|<!--/, 'no import, no closing script tag, no HTML comment');
	const used = new Set<string>();
	for (const name of names) {
		const html = fs.readFileSync(path.join(components, name, 'preview.html'), 'utf8');
		for (const m of html.slice(html.indexOf('<body')).matchAll(/<(ue-[a-z0-9-]+)/g)) used.add(m[1]);
		assert.doesNotMatch(html, /src="[^"]*bundle\.js"/, name + ' must not load bundle.js itself');
	}
	await withBrowser(async (browser) => {
		const { page, errors } = await openPreview(browser, 'Cover');
		await page.addScriptTag({ content: source });
		const missing = await page.evaluate((tags) => tags.filter((tag) => !customElements.get(tag)), Array.from(used));
		assert.deepEqual(missing, []);
		assert.deepEqual(errors, []);
		await page.close();
	});
});
