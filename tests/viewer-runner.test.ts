import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { root, serve, tokensCss, withBrowser, withBundle } from './lib.ts';

// The Design System viewer shows a preview by parking its HTML with the parent and loading a runner frame.
// The runner rewrites its own URL to the preview's URL and document.write()s the HTML, so relative scripts resolve from the preview's folder.
const RUNNER = `<!doctype html><meta charset="utf-8"><script>
(function () {
	var parked = parent.__previewRunner.take(location.hash.slice(1));
	history.replaceState(null, '', parked.url);
	document.write(parked.html);
})();
</script>`;

const components = path.join(root, 'components');
const names = fs.readdirSync(components, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'Cover' && fs.existsSync(path.join(components, e.name, 'preview.html'))).map((e) => e.name).sort();

test('a preview written by the viewer runner gets live elements from the preloaded bundle', async () => {
	await withBrowser(async (browser) => {
		const base = await serve();
		const failures: string[] = [];
		for (const name of names) {
			const page = await browser.newPage({ viewport: { width: 1300, height: 960 } });
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(String(e)));
			page.on('console', (m) => {
				if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text());
			});
			await page.route('**/__runner.html', (route) => route.fulfill({ body: RUNNER, contentType: 'text/html' }));
			await page.route('**/_blob/**', (route) => route.fulfill({ status: 204 }));
			await page.goto(base + '/components/Cover/preview.html');
			const url = '/components/' + name + '/preview.html';
			const html = withBundle(fs.readFileSync(path.join(components, name, 'preview.html'), 'utf8').replace('</head>', '<style>' + tokensCss() + '</style></head>'));
			await page.evaluate(([target, source]) => {
				(window as unknown as { __previewRunner: unknown }).__previewRunner = { take: () => ({ url: target, html: source }) };
				const frame = document.createElement('iframe');
				frame.id = 'viewer-frame';
				frame.style.cssText = 'width:1300px;height:960px';
				frame.src = '/__runner.html#token';
				document.body.append(frame);
			}, [url, html]);
			const handle = await page.waitForSelector('#viewer-frame');
			const frame = await handle.contentFrame();
			assert.ok(frame, name + ': the runner frame loads');
			await frame.waitForFunction(() => Array.from(document.querySelectorAll('*')).some((el) => el.localName.startsWith('ue-')), undefined, { timeout: 5000 }).catch(() => undefined);
			const report = await frame.evaluate(() => {
				const tags = Array.from(new Set(Array.from(document.querySelectorAll('*')).map((el) => el.localName).filter((tag) => tag.startsWith('ue-'))));
				return { location: location.pathname, tags: tags.map((tag) => ({ tag, defined: Boolean(customElements.get(tag)) })) };
			});
			if (report.location !== url) failures.push(name + ': runner url ' + report.location);
			if (report.tags.length === 0) failures.push(name + ': no ue-* element');
			for (const entry of report.tags) if (!entry.defined) failures.push(name + ': ' + entry.tag + ' is not defined');
			if (errors.length > 0) failures.push(name + ': ' + errors.join(' | '));
			await page.close();
		}
		assert.deepEqual(failures, []);
	});
});
