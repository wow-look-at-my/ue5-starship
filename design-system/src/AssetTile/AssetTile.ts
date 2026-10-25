// <ue-asset-tile> wraps a group of .AssetTile items: single, Ctrl/Cmd and Shift selection, arrow-key movement, open on double-click or Enter.
import { UeElement, define } from '../_shared/element.ts';
import { nearestInRow } from '../_shared/tileGrid.ts';

const SELECTED = 'is-selected';

class AssetTileElement extends UeElement {
	#anchor: HTMLElement | null = null;
	#opened = '';

	protected setup(): void {
		this.#anchor = null;
		this.#opened = '';
		for (const group of this.#groups()) {
			group.setAttribute('role', 'listbox');
			group.setAttribute('aria-multiselectable', 'true');
			for (const tile of this.#tiles(group)) {
				tile.setAttribute('role', 'option');
				tile.setAttribute('aria-selected', String(tile.classList.contains(SELECTED)));
			}
			this.#rove(group, null);
		}
		this.#status();
		this.on(this, 'click', (event) => this.#click(event));
		this.on(this, 'dblclick', (event) => this.#open(this.#tileAt(event.target)));
		this.on(this, 'keydown', (event) => this.#keydown(event));
	}

	#groups(): HTMLElement[] {
		const groups = new Set<HTMLElement>();
		for (const tile of this.all('.AssetTile')) if (tile.parentElement) groups.add(tile.parentElement);
		return Array.from(groups);
	}

	#tiles(group: HTMLElement): HTMLElement[] {
		return Array.from(group.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('AssetTile'));
	}

	#tileAt(target: EventTarget | null): HTMLElement | null {
		return target instanceof Element ? target.closest<HTMLElement>('.AssetTile') : null;
	}

	#name(tile: HTMLElement): string {
		return (tile.querySelector('.AssetTile__name')?.textContent ?? '').trim();
	}

	// One tile per group takes the Tab stop: `stop`, else the first selected tile, else the first tile.
	#rove(group: HTMLElement, stop: HTMLElement | null): void {
		const tiles = this.#tiles(group);
		const chosen = stop ?? tiles.find((tile) => tile.classList.contains(SELECTED)) ?? tiles[0];
		for (const tile of tiles) tile.tabIndex = tile === chosen ? 0 : -1;
	}

	#mark(tile: HTMLElement, selected: boolean): void {
		tile.classList.toggle(SELECTED, selected);
		tile.setAttribute('aria-selected', String(selected));
	}

	// Applies a click or key movement to the selection of the tile's group.
	#choose(tile: HTMLElement, toggle: boolean, range: boolean): void {
		const group = tile.parentElement;
		if (!group) return;
		const tiles = this.#tiles(group);
		if (range && this.#anchor && tiles.includes(this.#anchor)) {
			const from = tiles.indexOf(this.#anchor);
			const to = tiles.indexOf(tile);
			tiles.forEach((each, i) => this.#mark(each, i >= Math.min(from, to) && i <= Math.max(from, to)));
		} else if (toggle) {
			this.#mark(tile, !tile.classList.contains(SELECTED));
			this.#anchor = tile;
		} else {
			for (const each of tiles) this.#mark(each, each === tile);
			this.#anchor = tile;
		}
		this.#rove(group, tile);
		this.#status();
		this.emit('assettile:select', { names: tiles.filter((each) => each.classList.contains(SELECTED)).map((each) => this.#name(each)) });
	}

	#click(event: MouseEvent): void {
		const tile = this.#tileAt(event.target);
		if (!tile) return;
		this.#choose(tile, event.ctrlKey || event.metaKey, event.shiftKey);
		tile.focus();
	}

	#open(tile: HTMLElement | null): void {
		if (!tile) return;
		const name = this.#name(tile);
		this.#opened = name;
		this.#status();
		this.emit('assettile:open', { name, folder: tile.classList.contains('AssetTile--folder') });
	}

	#status(): void {
		const line = this.one('.AssetTilePreview__status');
		if (!line) return;
		const selected = this.all('.AssetTile.' + SELECTED).map((tile) => this.#name(tile));
		const head = selected.length === 0 ? 'Nothing selected' : selected.length + ' selected: ' + selected.join(', ');
		line.textContent = head + (this.#opened ? '. Opened: ' + this.#opened : '');
	}

	#keydown(event: KeyboardEvent): void {
		const tile = event.target instanceof HTMLElement && event.target.matches('.AssetTile') ? event.target : null;
		const group = tile?.parentElement;
		if (!tile || !group) return;
		const tiles = this.#tiles(group);
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
				this.#open(tile);
				return;
			case ' ':
				event.preventDefault();
				this.#choose(tile, event.ctrlKey || event.metaKey, event.shiftKey);
				return;
			case 'a':
			case 'A':
				if (!(event.ctrlKey || event.metaKey)) return;
				event.preventDefault();
				for (const each of tiles) this.#mark(each, true);
				this.#status();
				return;
			default:
				return;
		}
		event.preventDefault();
		if (!go) return;
		if (event.ctrlKey || event.metaKey) {
			this.#rove(group, go);
		} else {
			this.#choose(go, false, event.shiftKey);
		}
		go.focus();
	}
}

define('ue-asset-tile', AssetTileElement);
