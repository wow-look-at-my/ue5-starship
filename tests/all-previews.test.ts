import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
<<<<<<< HEAD
import { openPreview, root, serve, withBrowser } from './lib.ts';

const components = path.join(root, 'components');
const names = fs.readdirSync(components, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(components, e.name, 'preview.html'))).map((e) => e.name).sort();
const STATIC = new Set<string>();
=======
import { openPreview, root, withBrowser } from './lib.ts';

const components = path.join(root, 'components');
const names = fs.readdirSync(components, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(components, e.name, 'preview.html'))).map((e) => e.name).sort();
const STATIC = new Set(['Cover']);
>>>>>>> origin/master

test('every component folder is covered by this check', () => {
	assert.ok(names.length >= 36, 'found ' + names.length + ' previews');
});

for (const name of names.filter((n) => !STATIC.has(n))) {
<<<<<<< HEAD
	test(name + ': the preview carries no script, the bundle supplies every element', () => {
		const html = fs.readFileSync(path.join(components, name, 'preview.html'), 'utf8');
		assert.doesNotMatch(html, /<script/i, 'script tag');
=======
	test(name + ': scripts are compiled TypeScript modules only', () => {
		const html = fs.readFileSync(path.join(components, name, 'preview.html'), 'utf8');
		const body = html.slice(html.indexOf('<body'));
		const inline = [...body.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].filter((m) => m[1].trim() !== '');
		assert.equal(inline.length, 0, 'inline script bodies');
		const modules = [...body.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map((m) => m[1]);
		assert.ok(modules.length > 0, 'a module script');
		for (const src of modules) assert.ok(fs.existsSync(path.join(components, name, src)), src + ' exists');
>>>>>>> origin/master
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
<<<<<<< HEAD

const kebab = (name: string): string => 'ue-' + name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

for (const name of names.filter((n) => fs.existsSync(path.join(components, n, n + '.js')))) {
	test(name + ': the standalone ES module defines the element and sets up every instance', async () => {
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

// Every folder glyph draws its shape centred in its icon box: the box minus its padding, within 0.1px.
const FOLDER_GLYPHS = ['.tr-icon.is-folder', '.AssetTile__folderIcon', '.ContentToolbar__folder', '[data-role="browse"] svg', '[aria-label="Create folder"] svg', '.checkbox-toggle__icon'];
for (const name of ['AssetPicker', 'AssetTile', 'ContentBrowser', 'ContentToolbar', 'SourcePanel', 'TreeRow', 'SceneOutliner', 'EditorLayout']) {
	test(name + ': every folder glyph is centred in its icon box', async () => {
		await withBrowser(async (browser) => {
			const { page } = await openPreview(browser, name);
			const report = await page.evaluate((selectors) => {
				const off: string[] = [];
				let checked = 0;
				for (const svg of Array.from(document.querySelectorAll<SVGSVGElement>(selectors.join(',')))) {
					const box = svg.getBoundingClientRect();
					if (box.width === 0 || box.height === 0) continue;
					const style = getComputedStyle(svg);
					const left = box.left + parseFloat(style.paddingLeft);
					const right = box.right - parseFloat(style.paddingRight);
					const top = box.top + parseFloat(style.paddingTop);
					const bottom = box.bottom - parseFloat(style.paddingBottom);
					let x0 = Infinity;
					let y0 = Infinity;
					let x1 = -Infinity;
					let y1 = -Infinity;
					for (const shape of Array.from(svg.querySelectorAll('path, circle, rect'))) {
						if (getComputedStyle(shape).display === 'none') continue;
						const r = shape.getBoundingClientRect();
						x0 = Math.min(x0, r.left);
						y0 = Math.min(y0, r.top);
						x1 = Math.max(x1, r.right);
						y1 = Math.max(y1, r.bottom);
					}
					const dx = (x0 + x1) / 2 - (left + right) / 2;
					const dy = (y0 + y1) / 2 - (top + bottom) / 2;
					checked++;
					if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) off.push((svg.getAttribute('class') ?? svg.parentElement?.getAttribute('aria-label')) + ' off by ' + dx.toFixed(2) + ', ' + dy.toFixed(2));
				}
				return { checked, off: Array.from(new Set(off)) };
			}, FOLDER_GLYPHS);
			assert.ok(report.checked > 0, 'a folder glyph in the preview');
			assert.deepEqual(report.off, []);
			await page.close();
		});
	});
}

// Composition: each class is styled by one component, and markup that uses a component's classes sits inside that component's element.
const src = path.join(root, 'src');
const sources = fs.readdirSync(src, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name).sort();

function selectorClasses(css: string): Set<string> {
	const out = new Set<string>();
	for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
		if (m[1].trim().startsWith('@')) continue;
		for (const c of m[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (!/^(is|has)-/.test(c[1])) out.add(c[1]);
	}
	return out;
}

const previewStyle = (name: string): string => Array.from(fs.readFileSync(path.join(components, name, 'preview.html'), 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), (m) => m[1]).join('\n');

const owners = new Map<string, string[]>();
for (const name of sources) {
	for (const file of fs.readdirSync(path.join(src, name)).filter((f) => f.endsWith('.css'))) {
		for (const cls of selectorClasses(fs.readFileSync(path.join(src, name, file), 'utf8'))) owners.set(cls, [...new Set([...(owners.get(cls) ?? []), name])]);
	}
}

test('every class is styled by exactly one component stylesheet', () => {
	assert.deepEqual(Array.from(owners).filter(([, list]) => list.length > 1).map(([cls, list]) => cls + ' in ' + list.join(' and ')), []);
});

for (const name of names) {
	test(name + ': the preview style does not restyle another component', () => {
		assert.deepEqual(Array.from(selectorClasses(previewStyle(name))).filter((cls) => owners.has(cls) && !owners.get(cls)?.includes(name)).map((cls) => cls + ' (' + owners.get(cls)?.join(', ') + ')'), []);
	});

	test(name + ': markup that uses a component class sits inside that component element', async () => {
		const classTags = Object.fromEntries(Array.from(owners, ([cls, list]) => [cls, list.map(kebab)]));
		await withBrowser(async (browser) => {
			const { page } = await openPreview(browser, name);
			const loose = await page.evaluate((map) => {
				const found = new Set<string>();
				for (const el of Array.from(document.body.querySelectorAll('[class]'))) {
					for (const cls of Array.from(el.classList)) {
						const tags = map[cls];
						if (tags && !tags.some((tag) => el.closest(tag))) found.add(cls + ' outside ' + tags.join('/'));
					}
				}
				return Array.from(found).sort();
			}, classTags);
			assert.deepEqual(loose, []);
			await page.close();
		});
	});
}
=======
>>>>>>> origin/master
