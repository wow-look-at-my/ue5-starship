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

// Returns the nth live (not pinned) custom element named `tag`, whole.
function element(page: string, tag: string, nth = 0): string {
	const html = page.slice(page.indexOf('<body'));
	const open = new RegExp('<' + tag + '\\b[^>]*>', 'g');
	let seen = 0;
	for (let m = open.exec(html); m; m = open.exec(html)) {
		if (/data-pinned/.test(m[0])) continue;
		if (seen++ < nth) continue;
		return balancedFrom(html, m.index, tag);
	}
	throw new Error('not found: ' + tag + ' #' + nth);
}

const symbols = (html: string): string => [...html.matchAll(/<symbol[\s\S]*?<\/symbol>/g)].map((m) => m[0]).join('\n');

// The previews supply the markup and the icon symbols. Every component look comes from components/bundle.css.
const names = ['WindowChrome', 'MenuBar', 'ToolBar', 'PlaceActorsPanel', 'DetailsHeader', 'DetailsSearchRow', 'FilterPills', 'DetailsCategory', 'SceneOutliner', 'ContentBrowser', 'StatusBar'];
const html = Object.fromEntries(names.map((n) => [n, read(n)]));

// The live instance of each component is its custom element, whole, so the composed window keeps the behaviour.
// The window is the WindowChrome frame with the editor in place of its stand-in content area.
const menu = element(html.MenuBar, 'ue-menu-bar');
let frame = extract(html.WindowChrome, 'div', 'windowChrome-frame');
frame = frame.replace(extract(frame, 'div', 'windowChrome-menu'), '<div class="windowChrome-menu">' + menu + '</div>');
const content = extract(frame, 'div', 'windowChrome-content');
const toolbar = element(html.ToolBar, 'ue-tool-bar');
const place = element(html.PlaceActorsPanel, 'ue-place-actors-panel');
const details = element(html.DetailsCategory, 'ue-details-category', 1);
const outliner = element(html.SceneOutliner, 'ue-scene-outliner');
const browser = element(html.ContentBrowser, 'ue-content-browser');
const status = element(html.StatusBar, 'ue-status-bar').replace('<ue-status-bar>', '<ue-status-bar docked>');

const ICONS: Record<string, string> = {
	details: 'M2.500 4h11 M2.500 8h11 M2.500 12h7',
	outliner: 'M5.500 3.500h8 M5.500 8h8 M5.500 12.500h8 M2.500 3.500h.5 M2.500 8h.5 M2.500 12.500h.5',
	folder: 'M2 4.500h4l1.500 1.500H14v6.500H2z',
	world: 'M1.500 13.500 6.500 5l3 5 1.500-2 3.500 5.500z M6.500 5V2.500h3',
	close: 'M4.500 4.500l7 7 M11.500 4.500l-7 7',
};
const glyph = (name: string): string => '<svg viewBox="0 0 16 16"><path d="' + ICONS[name] + '"/></svg>';
const tab = (id: string, icon: string, label: string): string => '<ue-dock-tab><div class="dockTab dockTab--foreground dockTab--active" role="tab" tabindex="0" aria-selected="true" data-tab="' + id + '"><span class="dockTab-icon">' + glyph(icon) + '</span><span class="dockTab-label">' + label + '</span><span class="dockTab-close">' + glyph('close') + '</span></div></ue-dock-tab>';
const stack = (cls: string, id: string, icon: string, label: string, body: string): string => '<ue-tab-well><div class="tabWell-stack el-stack ' + cls + '"><div class="tabWell-well" role="tablist" aria-label="' + label + '">' + tab(id, icon, label) + '</div><div class="tabWell-content el-body"><div role="tabpanel" data-panel="' + id + '">' + body + '</div></div></div></ue-tab-well>';

const viewport = '<img class="el-viewport" src="' + (local ? LOCAL : BLOB) + '" alt="3D viewport placeholder">';

const defs = names.map((n) => symbols(html[n])).join('\n');

// Layout only: every rule targets an el-* class.
const layoutCss = `
	.el-root { width: 1280px; background: var(--background); font: 400 13.333px/1.2 var(--font-sans); color: var(--foreground); }
	.el-window { display: flex; flex-direction: column; }
	.el-toolbar { background: var(--panel); }
	.el-main { display: grid; grid-template-columns: 280px 1fr 372px; gap: 0 2px; height: 520px; background: var(--background); }
	.el-col { display: flex; flex-direction: column; min-width: 0; min-height: 0; gap: 2px; }
	.el-stack { display: flex; flex-direction: column; min-height: 0; flex: 1 1 0; }
	.el-body { overflow: hidden; padding: 0; flex: 1 1 auto; min-height: 0; }
	.el-body > [role="tabpanel"] { height: 100%; overflow: auto; }
	.el-viewport { display: block; width: 100%; height: 100%; object-fit: cover; }
	.el-details { flex: 3 1 0; } .el-outliner { flex: 2 1 0; }
	.el-bottom { height: 250px; margin-top: 2px; display: flex; }
`;

const marker = '<!-- @dsCard group="Layout" height=940 width=1280 subtitle="A whole editor window: title and menu, toolbar, Place Actors, viewport placeholder, Details, Outliner, Content Browser and status bar" -->\n';
const out = marker
	+ '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>EditorLayout</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Roboto+Condensed:wght@400;700&family=Roboto+Mono&display=swap">\n<style>body { font-family: var(--font-sans); }</style>\n<style>\n' + layoutCss + '</style>\n</head>\n<body>\n'
	+ '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>\n' + defs + '\n</defs></svg>\n'
	+ '<div class="el-root">\n<ue-window-chrome>\n' + frame.replace(content, '<div class="el-window">\n<div class="el-toolbar">' + toolbar + '</div>\n<div class="el-main">\n'
	+ '<div class="el-col">' + stack('', 'place', 'folder', 'Place Actors', place) + '</div>\n'
	+ '<div class="el-col">' + stack('', 'viewport', 'world', 'Viewport 1', viewport) + '</div>\n'
	+ '<div class="el-col">' + stack('el-details', 'details', 'details', 'Details', details) + stack('el-outliner', 'outliner', 'outliner', 'Outliner', outliner) + '</div>\n'
	+ '</div>\n<div class="el-bottom">' + stack('', 'content', 'folder', 'Content Browser', browser) + '</div>\n' + status + '\n</div>') + '\n</ue-window-chrome>\n</div>\n'
	+ '</body>\n</html>\n';

const dir = path.join(root, 'components', 'EditorLayout');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'preview.html'), out);
console.log('wrote ' + path.join(dir, 'preview.html') + ' (' + out.length + ' bytes)');
