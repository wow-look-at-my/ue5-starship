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
	test(name + ': scripts are compiled TypeScript modules only', () => {
		const html = fs.readFileSync(path.join(components, name, 'preview.html'), 'utf8');
		const body = html.slice(html.indexOf('<body'));
		const inline = [...body.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].filter((m) => m[1].trim() !== '');
		assert.equal(inline.length, 0, 'inline script bodies');
		const modules = [...body.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map((m) => m[1]);
		assert.ok(modules.length > 0, 'a module script');
		for (const src of modules) assert.ok(fs.existsSync(path.join(components, name, src)), src + ' exists');
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
