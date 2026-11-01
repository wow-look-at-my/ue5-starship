// <ue-content-browser> coordinates its nested composites. It owns the folder model and the current folder.
// The toolbar owns the history, the source panel owns the folder tree, the asset tiles own the tile selection.
import { UeElement, define } from '../_shared/element.ts';
import type { AssetSearchBarElement } from '../AssetSearchBar/AssetSearchBar.ts';
import '../AssetSearchBar/AssetSearchBar.ts';
import type { AssetTileElement, TileOpenDetail, TileSelectDetail } from '../AssetTile/AssetTile.ts';
import '../AssetTile/AssetTile.ts';
import type { ContentToolbarElement, ContentToolbarNavigateDetail } from '../ContentToolbar/ContentToolbar.ts';
import '../ContentToolbar/ContentToolbar.ts';
import type { SourcePanelElement, SourcePanelSelectDetail } from '../SourcePanel/SourcePanel.ts';
import '../SourcePanel/SourcePanel.ts';
import '../Splitter/Splitter.ts';
import type { TreeRowData } from '../TreeRow/TreeRow.ts';
import './ContentBrowser.css';

interface Folder {
	id: string;
	name: string;
	parent: Folder | null;
	kids: Folder[];
}

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

// The reference screenshot shows this tile selected.
const INITIAL_PICKED = ['Blueprints'];

function child(parent: Folder, name: string): Folder {
	const folder: Folder = { id: parent.id + '/' + name, name, parent, kids: [] };
	parent.kids.push(folder);
	return folder;
}

function buildModel(): { all: Folder; start: Folder } {
	const all: Folder = { id: 'All', name: 'All', parent: null, kids: [] };
	const start = child(child(all, 'Content'), 'StarterContent');
	for (const [name, kids] of STARTER) {
		const folder = child(start, name);
		for (const kid of kids) child(folder, kid);
	}
	return { all, start };
}

function pathOf(folder: Folder): string[] {
	const path: string[] = [];
	for (let at: Folder | null = folder; at; at = at.parent) path.unshift(at.name);
	return path;
}

export class ContentBrowserElement extends UeElement {
	#toolbar!: ContentToolbarElement;
	#sources!: SourcePanelElement;
	#search!: AssetSearchBarElement;
	#grid!: AssetTileElement;
	#status!: HTMLElement;
	#all!: Folder;
	#cur!: Folder;
	#byId = new Map<string, Folder>();
	#picked = new Set<Folder>();

	protected setup(): void {
		this.#toolbar = this.#need<ContentToolbarElement>('ue-content-toolbar');
		this.#sources = this.#need<SourcePanelElement>('ue-source-panel');
		this.#search = this.#need<AssetSearchBarElement>('ue-asset-search-bar');
		this.#grid = this.#need<AssetTileElement>('ue-asset-tile');
		this.#status = this.#need('.ContentBrowser__status');
		const model = buildModel();
		this.#all = model.all;
		this.#cur = model.start;
		const index = (folder: Folder): void => {
			this.#byId.set(folder.id, folder);
			folder.kids.forEach(index);
		};
		index(model.all);

		this.on(this, 'contenttoolbar:navigate', (event) => {
			const folder = this.#byId.get((event as CustomEvent<ContentToolbarNavigateDetail>).detail.path.join('/'));
			if (folder) this.#show(folder);
		});
		this.on(this, 'sourcepanel:select', (event) => {
			const folder = this.#byId.get((event as CustomEvent<SourcePanelSelectDetail>).detail.id);
			if (folder) this.#go(folder);
		});
		this.on(this, 'assetsearchbar:change', () => this.#renderAssets());
		this.on(this, 'ue-tile-select', (event) => this.#pick((event as CustomEvent<TileSelectDetail>).detail.ids));
		this.on(this, 'ue-tile-open', (event) => {
			const folder = this.#byId.get((event as CustomEvent<TileOpenDetail>).detail.id);
			if (folder) this.#go(folder);
		});

		// The nested elements run their own setup after this, so they get their data once the page finished parsing.
		const timer = setTimeout(() => this.#populate(), 0);
		this.onDispose(() => clearTimeout(timer));
	}

	#need<T extends HTMLElement = HTMLElement>(selector: string): T {
		const found = this.one<T>(selector);
		if (!found) throw new Error('ue-content-browser needs ' + selector);
		return found;
	}

	#populate(): void {
		const start = this.#cur;
		const open = new Set<Folder>();
		for (let at = start.parent; at; at = at.parent) open.add(at);
		const rows: TreeRowData[] = [];
		const walk = (folder: Folder, depth: number): void => {
			rows.push({ id: folder.id, label: folder.name, depth, icon: 'folder', expanded: open.has(folder) || folder === start, selected: folder === start });
			for (const kid of folder.kids) walk(kid, depth + 1);
		};
		walk(this.#all, 0);
		this.#sources.setRows('project', rows);
		this.#toolbar.childrenOf = (path) => this.#byId.get(path.join('/'))?.kids.map((kid) => kid.name) ?? [];
		// The reference screenshot shows Back enabled, so the history starts with the parent folder.
		this.#toolbar.setHistory([pathOf(start.parent ?? start), pathOf(start)], 1);
		this.#picked = new Set(start.kids.filter((folder) => INITIAL_PICKED.includes(folder.name)));
		this.#search.setPlaceholder('Search ' + start.name);
		this.#renderAssets();
	}

	// ---- navigation ----

	#go(folder: Folder): void {
		if (folder === this.#cur) return;
		this.#toolbar.navigate(pathOf(folder));
		this.#show(folder);
	}

	#show(folder: Folder): void {
		this.#cur = folder;
		this.#picked.clear();
		for (let at = folder.parent; at; at = at.parent) this.#sources.setExpanded(at.id, true);
		this.#sources.select(folder.id);
		this.#search.setPlaceholder('Search ' + folder.name);
		this.#search.setText('');
		this.#renderAssets();
		this.emit('contentbrowser:navigate', { path: pathOf(folder) });
	}

	// ---- assets ----

	#shown(): Folder[] {
		const query = this.#search.text.trim().toLowerCase();
		return this.#cur.kids.filter((folder) => folder.name.toLowerCase().includes(query));
	}

	#renderAssets(): void {
		const shown = this.#shown();
		const hadFocus = this.#grid.contains(document.activeElement);
		this.#grid.setTiles(shown.map((folder) => ({ id: folder.id, label: folder.name, kind: 'folder' as const, selected: this.#picked.has(folder) })));
		if (hadFocus) this.#grid.querySelector<HTMLElement>('.AssetTile[tabindex="0"]')?.focus();
		this.#renderStatus(shown);
	}

	// A pick replaces the selection among the shown tiles. A hidden tile keeps its mark.
	#pick(ids: string[]): void {
		const shown = this.#shown();
		for (const folder of shown) this.#picked.delete(folder);
		for (const id of ids) {
			const folder = this.#byId.get(id);
			if (folder) this.#picked.add(folder);
		}
		this.#renderStatus(shown);
	}

	#renderStatus(shown: Folder[]): void {
		const picked = shown.filter((folder) => this.#picked.has(folder)).length;
		const count = shown.length === 1 ? '1 item' : shown.length + ' items';
		this.#status.textContent = picked === 0 ? count : count + ' (' + picked + ' selected)';
	}
}

define('ue-content-browser', ContentBrowserElement);
