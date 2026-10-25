import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { openPreview, root, withBrowser } from './lib.ts';

const components = path.join(root, 'components');
const names = fs.readdirSync(components, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(components, e.name, 'preview.html'))).map((e) => e.name).sort();
const STATIC = new Set(['Cover']);

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
