// Rebuilds components/EditorLayout/preview.html from the component previews.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', 'design-system');
const BLOB = '/_blob/a5eee8bb3006435518a23e42e3623041';
const LOCAL = '../../assets/Placeholders/viewport-placeholder.png';
const local = process.argv.includes('--local');

const read = (name: string): string => fs.readFileSync(path.join(root, 'components', name, 'preview.html'), 'utf8');

// Returns the outerHTML of the element whose opening tag starts at `start`.
function balancedFrom(html: string, start: number, tag: string): string {
	let depth = 0;
	const tokens = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'g');
	tokens.lastIndex = start;
	for (let t = tokens.exec(html); t; t = tokens.exec(html)) {
		if (t[0].endsWith('/>')) continue;
		depth += t[1] ? -1 : 1;
		if (depth === 0) return html.slice(start, t.index + t[0].length);
	}
	throw new Error('unbalanced ' + tag + ' at ' + start);
}

// Returns the custom element that wraps exactly the element at `start`, or null.
function wrapperOf(html: string, start: number, inner: string): string | null {
	const before = html.slice(0, start);
	const open = /<(ue-[a-z0-9-]+)\b[^>]*>\s*$/.exec(before);
	if (!open) return null;
	const wrapper = balancedFrom(html, open.index, open[1]);
	const tail = wrapper.slice(wrapper.indexOf(inner) + inner.length).replace(/<\/ue-[a-z0-9-]+>\s*$/, '');
	return tail.trim() === '' ? wrapper : null;
}

// Returns the nth unpinned element with class `cls`, widened to its custom-element wrapper when it has one.
function extract(html: string, tag: string, cls: string, nth = 0): string {
	const open = new RegExp('<' + tag + '\\b([^>]*)>', 'g');
	let seen = 0;
	for (let m = open.exec(html); m; m = open.exec(html)) {
		const attrs = m[1];
		const classes = /class="([^"]*)"/.exec(attrs);
		if (!classes || !classes[1].split(/\s+/).includes(cls)) continue;
		if (/data-pinned/.test(attrs)) continue;
		if (seen++ < nth) continue;
		const element = balancedFrom(html, m.index, tag);
		return wrapperOf(html, m.index, element) ?? element;
	}
	throw new Error('not found: ' + tag + '.' + cls + ' #' + nth);
}

// Returns the nth custom element named `tag`, whole.
function element(page: string, tag: string, nth = 0): string {
	const html = page.slice(page.indexOf('<body'));
	const open = new RegExp('<' + tag + '\\b[^>]*>', 'g');
	let seen = 0;
	for (let m = open.exec(html); m; m = open.exec(html)) {
		if (seen++ < nth) continue;
		return balancedFrom(html, m.index, tag);
	}
	throw new Error('not found: ' + tag + ' #' + nth);
}

const blocks = (html: string, tag: string): string => [...html.matchAll(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'g'))].map((m) => m[1]).join('\n');
const symbols = (html: string): string => [...html.matchAll(/<symbol[\s\S]*?<\/symbol>/g)].map((m) => m[0]).join('\n');
const stripPage = (css: string): string => css.replace(/(^|\n)\s*(html\s*,\s*)?body\s*\{[^}]*\}/g, '\n');
const modules = (name: string, html: string): string[] => [...html.matchAll(/<script type="module" src="\.\/([^"]+)"><\/script>/g)].map((m) => '../' + name + '/' + m[1]);

const names = ['WindowChrome', 'MenuBar', 'ToolBar', 'PlaceActorsPanel', 'DetailsHeader', 'DetailsSearchRow', 'FilterPills', 'DetailsCategory', 'SceneOutliner', 'ContentBrowser', 'StatusBar', 'TabWell'];
const html = Object.fromEntries(names.map((n) => [n, read(n)]));

// The live instance of each component is its custom element, whole, so the composed window keeps the behaviour.
const menu = element(html.MenuBar, 'ue-menu-bar');
let title = extract(html.WindowChrome, 'div', 'windowChrome-title');
title = title.replace(extract(title, 'div', 'windowChrome-menu'), '<div class="windowChrome-menu">' + menu + '</div>');

const toolbar = element(html.ToolBar, 'ue-tool-bar');
const place = element(html.PlaceActorsPanel, 'ue-place-actors-panel');
const details = element(html.DetailsCategory, 'ue-details-category', 1);
const outliner = element(html.SceneOutliner, 'ue-scene-outliner');
const browser = element(html.ContentBrowser, 'ue-content-browser');
const status = element(html.StatusBar, 'ue-status-bar');

const tab = (id: string, icon: string, label: string): string => '<div class="tabWell-tab tabWell-tab--foreground tabWell-tab--active" role="tab" tabindex="0" aria-selected="true" data-tab="' + id + '"><span class="tabWell-icon"><svg><use href="#tabWell-i-' + icon + '"/></svg></span><span class="tabWell-label">' + label + '</span><span class="tabWell-close"><svg><use href="#tabWell-i-close"/></svg></span></div>';
const stack = (cls: string, id: string, icon: string, label: string, body: string): string => '<ue-tab-well><div class="tabWell-stack ' + cls + '" style="width:100%"><div class="tabWell-well" role="tablist" aria-label="' + label + '">' + tab(id, icon, label) + '</div><div class="tabWell-content el-body"><div role="tabpanel" data-panel="' + id + '">' + body + '</div></div></div></ue-tab-well>';

const viewport = '<img class="el-viewport" src="' + (local ? LOCAL : BLOB) + '" alt="3D viewport placeholder">';

const css = names.map((n) => stripPage(blocks(html[n], 'style'))).join('\n');
const defs = names.map((n) => symbols(html[n])).join('\n');
const scripts = [...new Set(names.flatMap((n) => modules(n, html[n])))].map((src) => '<script type="module" src="' + src + '"></script>').join('\n');

const layoutCss = `
	.el-root { width: 1280px; background: var(--background); font: 400 13.333px/1.2 var(--font-sans); color: var(--foreground); display: flex; flex-direction: column; }
	.el-root .windowChrome-title { width: 100%; }
	.el-toolbar { background: var(--panel); }
	.el-main { display: grid; grid-template-columns: 280px 1fr 372px; gap: 0 2px; height: 520px; background: var(--background); }
	.el-col { display: flex; flex-direction: column; min-width: 0; min-height: 0; gap: 2px; }
	.el-root .tabWell-stack { display: flex; flex-direction: column; min-height: 0; flex: 1 1 0; }
	.el-root .el-body { overflow: hidden; padding: 0; flex: 1 1 auto; min-height: 0; }
	.el-root .el-body > [role="tabpanel"] { height: 100%; overflow: auto; }
	.el-root .menuBar-stage, .el-root .toolBar-stage, .el-root .statusBar-stage { margin: 0; padding: 0; min-height: 0; min-width: 0; }
	.el-root .statusBar-stage { position: relative; }
	.el-root .statusBar-history { position: absolute; bottom: 100%; left: 0; min-height: 0; margin: 0; z-index: 5; }
	.el-root .statusBar-history:empty { display: none; }
	.el-root .DetailsHeader-frame, .el-root .DetailsSearchRow-frame, .el-root .FilterPills-frame, .el-root .DetailsCategory-frame, .el-root .so-panel { width: 100%; }
	.el-root .ContentBrowser { width: 100%; margin: 0; }
	.el-root .statusBar { min-width: 0; }
	.el-viewport { display: block; width: 100%; height: 100%; object-fit: cover; }
	.el-details { flex: 3 1 0; } .el-outliner { flex: 2 1 0; }
	.el-bottom { height: 250px; margin-top: 2px; display: flex; }
`;

const marker = '<!-- @dsCard group="Layout" height=940 width=1280 subtitle="A whole editor window: title and menu, toolbar, Place Actors, viewport placeholder, Details, Outliner, Content Browser and status bar" -->\n';
const out = marker
	+ '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>EditorLayout</title>\n<style>\n' + css + layoutCss + '</style>\n</head>\n<body>\n'
	+ '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>\n' + defs + '\n</defs></svg>\n'
	+ '<div class="el-root">\n' + title + '\n<div class="el-toolbar">' + toolbar + '</div>\n<div class="el-main">\n'
	+ '<div class="el-col">' + stack('', 'place', 'folder', 'Place Actors', place) + '</div>\n'
	+ '<div class="el-col">' + stack('', 'viewport', 'world', 'Viewport 1', viewport) + '</div>\n'
	+ '<div class="el-col">' + stack('el-details', 'details', 'details', 'Details', details) + stack('el-outliner', 'outliner', 'outliner', 'Outliner', outliner) + '</div>\n'
	+ '</div>\n<div class="el-bottom">' + stack('', 'content', 'folder', 'Content Browser', browser) + '</div>\n' + status + '\n</div>\n'
	+ scripts + '\n</body>\n</html>\n';

const dir = path.join(root, 'components', 'EditorLayout');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'preview.html'), out);
console.log('wrote ' + path.join(dir, 'preview.html') + ' (' + out.length + ' bytes)');
