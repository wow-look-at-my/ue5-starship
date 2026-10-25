// <ue-content-browser> wraps the composed .ContentBrowser panel and wires toolbar, source tree, search, tiles and splitter to one in-memory folder model.
import { UeElement, define } from '../_shared/element.ts';
import { drag } from '../_shared/drag.ts';
import { openMenu, type MenuEntry, type MenuHandle } from '../_shared/contentMenu.ts';
import { nearestInRow } from '../_shared/tileGrid.ts';

interface Folder {
	name: string;
	parent: Folder | null;
	kids: Folder[];
}

const PREFIX = 'ContentBrowser';
const INDENT_PX = 10;
const MIN_SOURCES = 120;
const MIN_ASSETS = 200;
const HANDLE_PX = 2;
const CHEVRON = '<span class="ContentBrowser__delim"><svg><use href="#cb-chev-r"/></svg></span>';

// The folders of the reference screenshot, each with illustrative children.
const STARTER: Array<[string, string[]]> = [
	['Architecture', ['Walls', 'Floors']],
	['Audio', ['Music', 'Ambient']],
	['Blueprints', ['Actors']],
	['HDRI', ['Outdoor']],
	['Maps', ['Overview', 'Test']],
	['Materials', ['Metal', 'Wood']],
	['Particles', ['Fire', 'Smoke']],
	['Props', ['Furniture', 'Lamps']],
	['Shapes', ['Primitives']],
	['Textures', ['Brick', 'Stone']],
];

const ADD_ENTRIES: MenuEntry[] = [
	{ label: 'Import to Current Folder' },
	{ separator: true },
	{ label: 'New Folder' },
	{ label: 'Blueprint Class' },
	{ label: 'Level' },
	{ label: 'Material' },
];

const SETTINGS_DEFAULTS: Array<[string, boolean]> = [
	['Show Folders', true],
	['Show Empty Folders', false],
	['Show Favorites', false],
	['Show Developers Content', false],
	['Show Engine Content', false],
	['Show Plugin Content', true],
];

function child(parent: Folder, name: string): Folder {
	const folder: Folder = { name, parent, kids: [] };
	parent.kids.push(folder);
	return folder;
}

function buildModel(): { all: Folder; start: Folder } {
	const all: Folder = { name: 'All', parent: null, kids: [] };
	const content = child(all, 'Content');
	const start = child(content, 'StarterContent');
	for (const [name, kids] of STARTER) {
		const folder = child(start, name);
		for (const kid of kids) child(folder, kid);
	}
	return { all, start };
}

function pathOf(folder: Folder): Folder[] {
	const path: Folder[] = [];
	for (let at: Folder | null = folder; at; at = at.parent) path.unshift(at);
	return path;
}

function escape(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

class ContentBrowserElement extends UeElement {
	#root!: HTMLElement;
	#top!: HTMLElement;
	#body!: HTMLElement;
	#sources!: HTMLElement;
	#split!: HTMLElement;
	#tree!: HTMLElement;
	#tiles!: HTMLElement;
	#status!: HTMLElement;
	#input!: HTMLInputElement;
	#all!: Folder;
	#cur!: Folder;
	#open = new Set<Folder>();
	#history: Folder[] = [];
	#index = 0;
	#picked = new Set<Folder>();
	#anchor: Folder | null = null;
	#rowFolder = new WeakMap<Element, Folder>();
	#tileFolder = new WeakMap<Element, Folder>();
	#menu: MenuHandle | null = null;
	#checks = new Map<string, boolean>();

	protected setup(): void {
		this.#root = this.#need('.ContentBrowser');
		this.#top = this.#need('.ContentBrowser__top');
		this.#body = this.#need('.ContentBrowser__body');
		this.#sources = this.#need('.ContentBrowser__sources');
		this.#split = this.#need('.ContentBrowser__split');
		this.#tree = this.#need('.ContentBrowser__tree[data-folders]');
		this.#tiles = this.#need('.ContentBrowser__tiles');
		this.#status = this.#need('.ContentBrowser__status');
		this.#input = this.#need<HTMLInputElement>('.ContentBrowser__input');

		const keptNames = this.all('.ContentBrowser__tile.is-sel .ContentBrowser__label div').map((label) => (label.textContent ?? '').trim());
		const model = buildModel();
		this.#all = model.all;
		this.#cur = model.start;
		this.#open = new Set(pathOf(model.start));
		// The reference screenshot shows Back enabled, so the history starts with the parent folder.
		this.#history = [model.start.parent ?? model.start, model.start];
		this.#index = 1;
		this.#picked = new Set(model.start.kids.filter((folder) => keptNames.includes(folder.name)));
		this.#anchor = null;
		this.#menu = null;
		this.#checks = new Map(SETTINGS_DEFAULTS);

		for (const title of this.all('.ContentBrowser__title')) {
			const area = title.closest('.ContentBrowser__area');
			const body = area?.querySelector<HTMLElement>('.ContentBrowser__tree');
			title.setAttribute('role', 'button');
			title.tabIndex = 0;
			title.setAttribute('aria-expanded', String(body ? !body.hidden : false));
		}
		for (const control of this.all('.ContentBrowser__tool')) {
			control.setAttribute('role', 'button');
			control.tabIndex = 0;
			control.setAttribute('aria-pressed', 'false');
		}
		this.#tree.setAttribute('role', 'tree');
		this.#tiles.setAttribute('role', 'listbox');
		this.#tiles.setAttribute('aria-multiselectable', 'true');
		this.#split.setAttribute('role', 'separator');
		this.#split.setAttribute('aria-orientation', 'vertical');
		this.#split.tabIndex = 0;
		this.#setSourcesWidth(this.#sources.offsetWidth);
		this.#render();

		this.on(this.#root, 'click', (event) => this.#click(event));
		this.on(this.#root, 'dblclick', (event) => {
			const folder = this.#folderOfTile(event.target);
			if (folder) this.#go(folder);
		});
		this.on(this.#root, 'keydown', (event) => this.#keydown(event));
		this.on(this.#input, 'input', () => this.#renderTiles());
		let startWidth = 0;
		this.onDispose(
			drag(this.#split, {
				start: () => {
					startWidth = this.#sources.offsetWidth;
					this.#split.classList.add('is-dragging');
				},
				move: (_event, dx) => this.#setSourcesWidth(startWidth + dx),
				end: () => this.#split.classList.remove('is-dragging'),
			}),
		);
		this.onDispose(() => this.#menu?.close());
	}

	#need<T extends HTMLElement = HTMLElement>(selector: string): T {
		const found = this.one<T>(selector);
		if (!found) throw new Error('ue-content-browser needs ' + selector);
		return found;
	}

	// ---- navigation ----

	#go(folder: Folder): void {
		if (folder === this.#cur) return;
		this.#history = this.#history.slice(0, this.#index + 1);
		this.#history.push(folder);
		this.#index = this.#history.length - 1;
		this.#show(folder);
	}

	#walk(delta: number): void {
		const next = this.#index + delta;
		if (next < 0 || next >= this.#history.length) return;
		const hadFocus = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('ContentBrowser__nav');
		this.#index = next;
		this.#show(this.#history[next]);
		if (hadFocus) {
			const own = this.one<HTMLButtonElement>(delta < 0 ? '.ContentBrowser__nav--back' : '.ContentBrowser__nav--fwd');
			const other = this.one<HTMLButtonElement>(delta < 0 ? '.ContentBrowser__nav--fwd' : '.ContentBrowser__nav--back');
			(own && !own.disabled ? own : other)?.focus();
		}
	}

	#show(folder: Folder): void {
		for (let at = folder.parent; at; at = at.parent) this.#open.add(at);
		this.#cur = folder;
		this.#picked.clear();
		this.#anchor = null;
		this.#input.value = '';
		this.#render();
		this.emit('contentbrowser:navigate', { path: pathOf(folder).map((each) => each.name) });
	}

	#toggleOpen(folder: Folder): void {
		if (this.#open.has(folder)) {
			this.#open.delete(folder);
			if (pathOf(this.#cur).includes(folder) && this.#cur !== folder) {
				this.#go(folder);
				return;
			}
		} else {
			this.#open.add(folder);
		}
		this.#render();
	}

	// ---- rendering ----

	#render(): void {
		const active = document.activeElement;
		const rowFolder = active ? this.#rowFolder.get(active) : undefined;
		const tileFolder = active ? this.#tileFolder.get(active) : undefined;
		this.#input.placeholder = 'Search ' + this.#cur.name;
		this.#renderCrumbs();
		this.#renderNav();
		this.#renderTree();
		this.#renderTiles();
		if (rowFolder) this.#rowOf(rowFolder)?.focus();
		else if (tileFolder) this.#tileOf(tileFolder)?.focus();
	}

	#renderCrumbs(): void {
		const path = this.#need('.ContentBrowser__path');
		for (const old of this.all('.ContentBrowser__crumb, .ContentBrowser__delim')) old.remove();
		for (const folder of pathOf(this.#cur)) path.insertAdjacentHTML('beforeend', '<button class="ContentBrowser__crumb">' + escape(folder.name) + '</button>' + CHEVRON);
	}

	#renderNav(): void {
		const back = this.one<HTMLButtonElement>('.ContentBrowser__nav--back');
		const fwd = this.one<HTMLButtonElement>('.ContentBrowser__nav--fwd');
		if (back) back.disabled = this.#index === 0;
		if (fwd) fwd.disabled = this.#index >= this.#history.length - 1;
	}

	#renderTree(): void {
		const lines: string[] = [];
		const folders: Folder[] = [];
		const parents = new Set(pathOf(this.#cur).slice(0, -1));
		const walk = (folder: Folder, depth: number): void => {
			const kids = folder.kids.length > 0;
			const open = kids && this.#open.has(folder);
			const classes = ['ContentBrowser__row'];
			if (parents.has(folder)) classes.push('ContentBrowser__row--parent');
			if (depth === 0) classes.push('ContentBrowser__row--root');
			const selected = folder === this.#cur;
			if (selected) classes.push('ContentBrowser__row--sel');
			const expanded = kids ? ' aria-expanded="' + open + '"' : '';
			const style = depth > 0 ? ' style="padding-left:' + depth * INDENT_PX + 'px"' : '';
			const caret = kids ? '<svg><use href="#cb-' + (open ? 'cd' : 'cr') + '"/></svg>' : '';
			lines.push(
				'<div class="' + classes.join(' ') + '" role="treeitem" aria-level="' + (depth + 1) + '" aria-selected="' + selected + '"' + expanded + ' tabindex="' + (selected ? 0 : -1) + '"' + style + '>' +
					'<span class="ContentBrowser__exp">' + caret + '</span><svg class="ContentBrowser__fi"><use href="#cb-' + (open ? 'fo' : 'fc') + '"/></svg>' +
					'<span class="ContentBrowser__name">' + escape(folder.name) + '</span></div>',
			);
			folders.push(folder);
			if (open) for (const kid of folder.kids) walk(kid, depth + 1);
		};
		walk(this.#all, 0);
		this.#tree.innerHTML = lines.join('');
		this.#tree.querySelectorAll('.ContentBrowser__row').forEach((row, i) => this.#rowFolder.set(row, folders[i]));
		this.#revealSelected();
	}

	// Scrolls only the tree, never the page.
	#revealSelected(): void {
		const row = this.#tree.querySelector<HTMLElement>('.ContentBrowser__row--sel');
		if (!row || this.#tree.hidden) return;
		const area = this.#tree.getBoundingClientRect();
		const box = row.getBoundingClientRect();
		if (box.top < area.top) this.#tree.scrollTop -= area.top - box.top;
		else if (box.bottom > area.bottom) this.#tree.scrollTop += box.bottom - area.bottom;
	}

	#shownKids(): Folder[] {
		const query = this.#input.value.trim().toLowerCase();
		return this.#cur.kids.filter((folder) => folder.name.toLowerCase().includes(query));
	}

	#renderTiles(): void {
		const shown = this.#shownKids();
		const stop = shown.find((folder) => this.#picked.has(folder)) ?? shown[0];
		this.#tiles.innerHTML = shown
			.map(
				(folder) =>
					'<div class="ContentBrowser__tile' + (this.#picked.has(folder) ? ' is-sel' : '') + '" role="option" aria-selected="' + this.#picked.has(folder) + '" tabindex="' + (folder === stop ? 0 : -1) + '">' +
					'<div class="ContentBrowser__card"><div class="ContentBrowser__thumb"><svg><use href="#cb-folder64"/></svg></div>' +
					'<div class="ContentBrowser__label"><div>' + escape(folder.name) + '</div></div></div></div>',
			)
			.join('');
		this.#tiles.querySelectorAll('.ContentBrowser__tile').forEach((tile, i) => this.#tileFolder.set(tile, shown[i]));
		this.#renderStatus(shown);
		const clear = this.one('.ContentBrowser__clear');
		if (clear) clear.hidden = this.#input.value === '';
	}

	#renderStatus(shown: Folder[]): void {
		const picked = shown.filter((folder) => this.#picked.has(folder)).length;
		const count = shown.length === 1 ? '1 item' : shown.length + ' items';
		this.#status.textContent = picked === 0 ? count : count + ' (' + picked + ' selected)';
	}

	#rowOf(folder: Folder): HTMLElement | undefined {
		return Array.from(this.#tree.querySelectorAll<HTMLElement>('.ContentBrowser__row')).find((row) => this.#rowFolder.get(row) === folder);
	}

	#tileOf(folder: Folder): HTMLElement | undefined {
		return Array.from(this.#tiles.querySelectorAll<HTMLElement>('.ContentBrowser__tile')).find((tile) => this.#tileFolder.get(tile) === folder);
	}

	#folderOfTile(target: EventTarget | null): Folder | undefined {
		const tile = target instanceof Element ? target.closest('.ContentBrowser__tile') : null;
		return tile ? this.#tileFolder.get(tile) : undefined;
	}

	// ---- input ----

	#pick(folder: Folder, toggle: boolean, range: boolean): void {
		const shown = this.#shownKids();
		if (range && this.#anchor && shown.includes(this.#anchor)) {
			const from = shown.indexOf(this.#anchor);
			const to = shown.indexOf(folder);
			this.#picked = new Set(shown.slice(Math.min(from, to), Math.max(from, to) + 1));
		} else if (toggle) {
			if (!this.#picked.delete(folder)) this.#picked.add(folder);
			this.#anchor = folder;
		} else {
			this.#picked = new Set([folder]);
			this.#anchor = folder;
		}
		this.#renderTiles();
		this.#tileOf(folder)?.focus();
	}

	#setSourcesWidth(width: number): void {
		const room = this.#body.clientWidth - HANDLE_PX - MIN_ASSETS;
		const clamped = Math.round(Math.max(MIN_SOURCES, Math.min(room, width)));
		this.#sources.style.width = clamped + 'px';
		this.#split.setAttribute('aria-valuenow', String(clamped));
	}

	#clearSearch(): void {
		this.#input.value = '';
		this.#renderTiles();
		this.#input.focus();
	}

	#toggleMenu(anchor: HTMLElement, entries: MenuEntry[], onPick: (index: number) => void): void {
		const previous = this.#menu;
		if (previous) {
			previous.close();
			if (previous.anchor === anchor) return;
		}
		anchor.setAttribute('aria-haspopup', 'menu');
		this.#menu = openMenu(this.#top, anchor, {
			prefix: PREFIX,
			entries,
			onPick,
			onClose: () => {
				this.#menu = null;
			},
		});
	}

	#setSection(area: Element, open: boolean): void {
		const tree = area.querySelector<HTMLElement>('.ContentBrowser__tree');
		const arrow = area.querySelector('.ContentBrowser__head .ContentBrowser__arrow use');
		area.classList.toggle('is-collapsed', !open);
		if (tree) tree.hidden = !open;
		area.querySelector('.ContentBrowser__title')?.setAttribute('aria-expanded', String(open));
		arrow?.setAttribute('href', open ? '#cb-cd' : '#cb-cr');
	}

	#click(event: MouseEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		if (!target) return;
		const button = target.closest<HTMLButtonElement>('button');
		if (button?.disabled) return;
		if (target.closest('.ContentBrowser__crumb')) {
			const at = this.all('.ContentBrowser__crumb').indexOf(target.closest<HTMLElement>('.ContentBrowser__crumb') as HTMLElement);
			const folder = pathOf(this.#cur)[at];
			if (folder) this.#go(folder);
		} else if (target.closest('.ContentBrowser__nav--back')) {
			this.#walk(-1);
		} else if (target.closest('.ContentBrowser__nav--fwd')) {
			this.#walk(1);
		} else if (target.closest('.ContentBrowser__add')) {
			this.#toggleMenu(target.closest<HTMLElement>('.ContentBrowser__add') as HTMLElement, ADD_ENTRIES, () => undefined);
		} else if (target.closest('.ContentBrowser__settings')) {
			const entries = Array.from(this.#checks, ([label, checked]): MenuEntry => ({ label, checkable: true, checked }));
			this.#toggleMenu(target.closest<HTMLElement>('.ContentBrowser__settings') as HTMLElement, entries, (index) => {
				const label = entries[index].label ?? '';
				this.#checks.set(label, !this.#checks.get(label));
			});
		} else if (target.closest('.ContentBrowser__clear')) {
			this.#clearSearch();
		} else if (target.closest('.ContentBrowser__tool')) {
			const tool = target.closest<HTMLElement>('.ContentBrowser__tool') as HTMLElement;
			tool.setAttribute('aria-pressed', String(tool.getAttribute('aria-pressed') !== 'true'));
		} else if (target.closest('.ContentBrowser__head')) {
			const area = target.closest('.ContentBrowser__area');
			if (area) this.#setSection(area, area.classList.contains('is-collapsed'));
		} else if (target.closest('.ContentBrowser__row')) {
			const row = target.closest('.ContentBrowser__row') as Element;
			const folder = this.#rowFolder.get(row);
			if (!folder) return;
			if (target.closest('.ContentBrowser__exp')) this.#toggleOpen(folder);
			else {
				this.#go(folder);
				this.#rowOf(folder)?.focus();
			}
		} else {
			const folder = this.#folderOfTile(target);
			if (folder) this.#pick(folder, event.ctrlKey || event.metaKey, event.shiftKey);
		}
	}

	#keydown(event: KeyboardEvent): void {
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (!target) return;
		const activate = event.key === 'Enter' || event.key === ' ';
		if (activate && target.matches('.ContentBrowser__title, .ContentBrowser__tool')) {
			event.preventDefault();
			target.click();
		} else if (target === this.#input) {
			if (event.key === 'Escape' && this.#input.value !== '') {
				event.preventDefault();
				this.#clearSearch();
			}
		} else if (target === this.#split) {
			const step = event.shiftKey ? 50 : 10;
			if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				event.preventDefault();
				this.#setSourcesWidth(this.#sources.offsetWidth + (event.key === 'ArrowLeft' ? -step : step));
			}
		} else if (target.matches('.ContentBrowser__row')) {
			this.#treeKey(event, target);
		} else if (target.matches('.ContentBrowser__tile')) {
			this.#tileKey(event, target);
		}
	}

	#treeKey(event: KeyboardEvent, row: HTMLElement): void {
		const folder = this.#rowFolder.get(row);
		if (!folder) return;
		const rows = Array.from(this.#tree.querySelectorAll<HTMLElement>('.ContentBrowser__row'));
		const at = rows.indexOf(row);
		const open = folder.kids.length > 0 && this.#open.has(folder);
		let go: Folder | undefined;
		switch (event.key) {
			case 'ArrowDown':
				go = this.#rowFolder.get(rows[at + 1]);
				break;
			case 'ArrowUp':
				go = this.#rowFolder.get(rows[at - 1]);
				break;
			case 'Home':
				go = this.#rowFolder.get(rows[0]);
				break;
			case 'End':
				go = this.#rowFolder.get(rows[rows.length - 1]);
				break;
			case 'ArrowRight':
				if (folder.kids.length > 0 && !open) this.#toggleOpen(folder);
				else if (open) go = folder.kids[0];
				break;
			case 'ArrowLeft':
				if (open) this.#toggleOpen(folder);
				else go = folder.parent ?? undefined;
				break;
			case 'Enter':
			case ' ':
				go = folder;
				break;
			default:
				return;
		}
		event.preventDefault();
		if (go) {
			this.#go(go);
			this.#rowOf(go)?.focus();
		} else {
			this.#rowOf(folder)?.focus();
		}
	}

	#tileKey(event: KeyboardEvent, tile: HTMLElement): void {
		const folder = this.#tileFolder.get(tile);
		if (!folder) return;
		const tiles = Array.from(this.#tiles.querySelectorAll<HTMLElement>('.ContentBrowser__tile'));
		const at = tiles.indexOf(tile);
		let go: HTMLElement | undefined;
		switch (event.key) {
			case 'ArrowRight':
				go = tiles[at + 1];
				break;
			case 'ArrowLeft':
				go = tiles[at - 1];
				break;
			case 'ArrowDown':
				go = nearestInRow(tiles, tile, true);
				break;
			case 'ArrowUp':
				go = nearestInRow(tiles, tile, false);
				break;
			case 'Home':
				go = tiles[0];
				break;
			case 'End':
				go = tiles[tiles.length - 1];
				break;
			case 'Enter':
				event.preventDefault();
				this.#go(folder);
				this.#tiles.querySelector<HTMLElement>('.ContentBrowser__tile')?.focus();
				return;
			case ' ':
				event.preventDefault();
				this.#pick(folder, event.ctrlKey || event.metaKey, event.shiftKey);
				return;
			default:
				return;
		}
		event.preventDefault();
		const next = go ? this.#tileFolder.get(go) : undefined;
		if (next) this.#pick(next, false, event.shiftKey);
	}
}

define('ue-content-browser', ContentBrowserElement);
