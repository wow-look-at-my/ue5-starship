/// <reference lib="dom" />
// Shared helpers for the preview interaction tests. The DOM lib types the callbacks that run in the page.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..', 'design-system');

interface TokenValue { [theme: string]: string }
interface Tokens {
	color: { themes: Array<{ id: string }>; tokens: Array<{ name: string; value: string | TokenValue }> };
	spacing: { tokens: Array<{ name: string; value: string }> };
	radius: { tokens: Array<{ name: string; value: string }> };
	type: { families: Record<string, string> };
}

// Builds the tokens.css that the preview frame preloads, from tokens.json (first theme).
export function tokensCss(): string {
	const tokens = JSON.parse(fs.readFileSync(path.join(root, 'tokens.json'), 'utf8')) as Tokens;
	const theme = tokens.color.themes[0].id;
	const vars: string[] = [];
	const resolve = (value: string | TokenValue): string => {
		const raw = typeof value === 'string' ? value : value[theme];
		const alias = /^\{(.+)\}$/.exec(raw);
		return alias ? 'var(--' + alias[1] + ')' : raw;
	};
	for (const t of tokens.color.tokens) vars.push('--' + t.name + ': ' + resolve(t.value) + ';');
	for (const t of tokens.spacing.tokens) vars.push('--' + t.name + ': ' + t.value + ';');
	for (const t of tokens.radius.tokens) vars.push('--' + t.name + ': ' + t.value + ';');
	for (const [key, stack] of Object.entries(tokens.type.families)) vars.push('--font-' + key + ': ' + stack + ';');
	return ':root { ' + vars.join(' ') + ' }\nbody { background: var(--background); color: var(--foreground); }';
}

export interface Preview {
	page: Page;
	errors: string[];
}

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
};

let baseUrl: Promise<string> | undefined;

// Serves design-system over http, because Chromium blocks module scripts on file://. One server per process.
function serve(): Promise<string> {
	baseUrl ??= new Promise((resolve, reject) => {
		const server = http.createServer((req, res) => {
			const file = path.join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
			if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
				res.writeHead(404).end();
				return;
			}
			res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
			fs.createReadStream(file).pipe(res);
		});
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.unref();
			const address = server.address();
			resolve('http://127.0.0.1:' + (typeof address === 'object' && address ? address.port : 0));
		});
	});
	return baseUrl;
}

// Opens a component preview with the tokens injected. Console and page errors collect in `errors`.
export async function openPreview(browser: Browser, name: string, viewport = { width: 1000, height: 800 }): Promise<Preview> {
	const page = await browser.newPage({ viewport });
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	page.on('console', (m) => {
		if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text());
	});
	await page.goto((await serve()) + '/components/' + name + '/preview.html');
	await page.addStyleTag({ content: tokensCss() });
	await page.waitForTimeout(100);
	return { page, errors };
}

// Runs a test body with a fresh browser and always closes it.
export async function withBrowser(body: (browser: Browser) => Promise<void>): Promise<void> {
	const browser = await chromium.launch();
	try {
		await body(browser);
	} finally {
		await browser.close();
	}
}

export const background = (page: Page, selector: string): Promise<string> => page.$eval(selector, (el) => getComputedStyle(el).backgroundColor);
