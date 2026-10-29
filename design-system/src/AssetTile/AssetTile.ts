// <ue-asset-tile> wraps one .AssetTile-grid of .AssetTile items: single, Ctrl/Cmd and Shift selection, arrow-key movement, open on double-click or Enter.
import { UeElement, define } from '../_shared/element.ts';
import { nearestInRow } from '../_shared/tileGrid.ts';
import './AssetTile.css';

const SELECTED = 'is-selected';

const FOLDER = '<svg class="AssetTile__folderIcon" viewBox="0 0 64 64" aria-hidden="true"><path d="M2 13a2 2 0 0 1 2-2h18l5 6h33a2 2 0 0 1 2 2v31a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="currentColor"/><path d="M2 13a2 2 0 0 1 2-2h18l5 6H2z" fill="#fff" opacity=".12"/><path d="M2 24h60v26a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#000" opacity=".12"/></svg>';
const CUBE = '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M16 3l11 6v14l-11 6-11-6V9z"/><path d="M5 9l11 6 11-6M16 15v14"/></g></svg>';

export interface TileData {
	id: string;
	label: string;
	kind: 'folder' | 'asset';
	// Image URL for the thumbnail of an asset. Without it the tile draws a cube.
	thumb?: string;
	// Class label under the name of an asset, such as "Static Mesh".
	typeLabel?: string;
	// CSS colour of the 2px strip at the foot of an asset thumbnail.
	strip?: string;
	selected?: boolean;
}

export interface TileSelectDetail {
	ids: string[];
}

export interface TileOpenDetail {
	id: string;
}

export class AssetTileElement extends UeElement {
	#anchor: HTMLElement | null = null;
	#grid: HTMLElement | null = null;
	#lastIds = '';

	protected setup(): void {
		this.#anchor = null;
		const grid = this.all('.AssetTile-grid').find((candidate) => this.owns(candidate)) ?? this.#createGrid();
		this.#grid = grid;
		grid.setAttribute('role', 'listbox');
		grid.setAttribute('aria-multiselectable', String(!this.#single()));
		for (const tile of this.#tiles()) {
			tile.setAttribute('role', 'option');
			tile.setAttribute('aria-selected', String(tile.classList.contains(SELECTED)));
		}
		this.#rove(null);
		this.#lastIds = this.getSelectedIds().join('\n');
		this.on(this, 'click', (event) => {
			if (this.owns(event.target)) this.#click(event);
		});
		this.on(this, 'dblclick', (event) => {
			if (this.owns(event.target)) this.#open(this.#tileAt(event.target));
		});
		this.on(this, 'keydown', (event) => {
			if (this.owns(event.target)) this.#keydown(event);
		});
	}

	#createGrid(): HTMLElement {
		const grid = document.createElement('div');
		grid.className = 'AssetTile-grid';
		this.append(grid);
		return grid;
	}

	// select="single" makes every click and key pick one tile. The default is multiple selection.
	#single(): boolean {
		return this.getAttribute('select') === 'single';
	}

	#tiles(): HTMLElement[] {
		return Array.from(this.#grid?.children ?? []).filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('AssetTile'));
	}

	#tileAt(target: EventTarget | null): HTMLElement | null {
		const tile = target instanceof Element ? target.closest<HTMLElement>('.AssetTile') : null;
		return tile && this.#tiles().includes(tile) ? tile : null;
	}

	#name(tile: HTMLElement): string {
		return (tile.querySelector('.AssetTile__name')?.textContent ?? '').trim();
	}

	#idOf(tile: HTMLElement): string {
		return tile.dataset.id ?? this.#name(tile);
	}

	// Ids of the selected tiles in grid order.
	getSelectedIds(): string[] {
		return this.#tiles().filter((tile) => tile.classList.contains(SELECTED)).map((tile) => this.#idOf(tile));
	}

	// Selects exactly these tiles. Ids that name no tile are ignored. A single-select grid keeps the first.
	select(ids: string[]): void {
		const wanted = new Set(this.#single() ? ids.slice(0, 1) : ids);
		const tiles = this.#tiles();
		for (const tile of tiles) this.#mark(tile, wanted.has(this.#idOf(tile)));
		this.#anchor = tiles.find((tile) => tile.classList.contains(SELECTED)) ?? null;
		this.#rove(this.#anchor);
		this.#announce();
	}

	// Replaces every tile with tiles drawn from data.
	setTiles(tiles: TileData[]): void {
		const grid = this.#grid;
		if (!grid) return;
		grid.replaceChildren(...tiles.map((data) => this.#draw(data)));
		this.#anchor = null;
		this.#rove(null);
		this.#lastIds = this.getSelectedIds().join('\n');
	}

	#draw(data: TileData): HTMLElement {
		const tile = document.createElement('div');
		const folder = data.kind === 'folder';
		tile.className = 'AssetTile ' + (folder ? 'AssetTile--folder' : 'AssetTile--asset') + (data.selected ? ' ' + SELECTED : '');
		tile.dataset.id = data.id;
		tile.setAttribute('role', 'option');
		tile.setAttribute('aria-selected', String(data.selected === true));
		const thumb = folder ? FOLDER : '<div class="AssetTile__asset"><span class="AssetTile__glyph"></span><span class="AssetTile__strip"></span></div>';
		tile.innerHTML = '<div class="AssetTile__card"><div class="AssetTile__thumb">' + thumb + '</div><div class="AssetTile__nameArea"><div class="AssetTile__name"></div>' + (folder ? '' : '<div class="AssetTile__class"></div>') + '</div></div>';
		const name = tile.querySelector('.AssetTile__name');
		if (name) name.textContent = data.label;
		if (!folder) {
			const holder = tile.querySelector('.AssetTile__glyph');
			if (holder && data.thumb) {
				const image = document.createElement('img');
				image.className = 'AssetTile__image';
				image.src = data.thumb;
				image.alt = '';
				holder.replaceWith(image);
			} else {
				holder?.insertAdjacentHTML('afterend', CUBE);
				holder?.remove();
			}
			const kind = tile.querySelector('.AssetTile__class');
			if (kind) kind.textContent = data.typeLabel ?? '';
			if (data.strip) tile.querySelector<HTMLElement>('.AssetTile__strip')?.style.setProperty('--strip', data.strip);
		}
		return tile;
	}

	// One tile takes the Tab stop: `stop`, else the first selected tile, else the first tile.
	#rove(stop: HTMLElement | null): void {
		const tiles = this.#tiles();
		const chosen = stop ?? tiles.find((tile) => tile.classList.contains(SELECTED)) ?? tiles[0];
		for (const tile of tiles) tile.tabIndex = tile === chosen ? 0 : -1;
	}

	// Announces the selection when it differs from the last one announced.
	#announce(): void {
		const ids = this.getSelectedIds();
		const key = ids.join('\n');
		if (key === this.#lastIds) return;
		this.#lastIds = key;
		this.emit<TileSelectDetail>('ue-tile-select', { ids });
	}

	#mark(tile: HTMLElement, selected: boolean): void {
		tile.classList.toggle(SELECTED, selected);
		tile.setAttribute('aria-selected', String(selected));
	}

	// Applies a click or key movement to the selection of the tile's group.
	#choose(tile: HTMLElement, wantToggle: boolean, wantRange: boolean): void {
		const toggle = wantToggle && !this.#single();
		const range = wantRange && !this.#single();
		const tiles = this.#tiles();
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
		this.#rove(tile);
		this.#announce();
	}

	#click(event: MouseEvent): void {
		const tile = this.#tileAt(event.target);
		if (!tile) return;
		this.#choose(tile, event.ctrlKey || event.metaKey, event.shiftKey);
		tile.focus();
	}

	#open(tile: HTMLElement | null): void {
		if (!tile) return;
		this.emit<TileOpenDetail>('ue-tile-open', { id: this.#idOf(tile) });
	}

	#keydown(event: KeyboardEvent): void {
		const tile = event.target instanceof HTMLElement && event.target.matches('.AssetTile') ? this.#tileAt(event.target) : null;
		if (!tile) return;
		const tiles = this.#tiles();
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
				if (!(event.ctrlKey || event.metaKey) || this.#single()) return;
				event.preventDefault();
				for (const each of tiles) this.#mark(each, true);
				this.#announce();
				return;
			default:
				return;
		}
		event.preventDefault();
		if (!go) return;
		if ((event.ctrlKey || event.metaKey) && !this.#single()) {
			this.#rove(go);
		} else {
			this.#choose(go, false, event.shiftKey);
		}
		go.focus();
	}
}

define('ue-asset-tile', AssetTileElement);
