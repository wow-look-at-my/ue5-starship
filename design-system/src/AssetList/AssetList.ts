// <ue-asset-list> is the list view of SAssetView: a header, a scrolling listbox of asset rows and an item count.
// It filters by name, hides engine content until asked, keeps one selected row and sorts by name.
import { UeElement, define } from '../_shared/element.ts';
import '../HeaderRow/HeaderRow.ts';
import '../Scrollbar/Scrollbar.ts';
import type { SortDetail } from '../HeaderRow/HeaderRow.ts';
import type { ScrollbarVisibilityDetail } from '../Scrollbar/Scrollbar.ts';
import './AssetList.css';

const ROW = '.AssetList__row';
const CUBE = '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M16 3l11 6v14l-11 6-11-6V9z"/><path d="M5 9l11 6 11-6M16 15v14"/></g></svg>';

export interface AssetItem {
	id: string;
	label: string;
	// Class label under the name, such as "Static Mesh".
	typeLabel?: string;
	// Object path. A path under /Engine/ is engine content.
	path?: string;
	// CSS colour of the 2px strip at the foot of the thumbnail.
	strip?: string;
	// Image URL for the thumbnail. Without it the row draws a cube.
	thumb?: string;
}

export interface AssetListSelectDetail {
	id: string | null;
}

export interface AssetListActivateDetail {
	id: string;
}

export class AssetListElement extends UeElement {
	#query = '';
	#showEngine = false;
	#descending = false;

	protected setup(): void {
		const rows = this.#rows;
		rows.setAttribute('role', 'listbox');
		for (const row of this.#all()) row.setAttribute('role', 'option');
		this.#showEngine = this.hasAttribute('show-engine');
		this.#refresh();

		this.on(rows, 'click', (event) => {
			const row = this.#rowAt(event.target);
			if (!row) return;
			this.#choose(row);
			this.emit<AssetListActivateDetail>('ue-asset-list-activate', { id: this.#idOf(row) });
		});
		this.on(rows, 'keydown', (event) => {
			if (event.target !== rows) return;
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') this.move(event.key === 'ArrowDown' ? 1 : -1);
			else if (event.key === 'Home') this.#choose(this.visibleRows()[0] ?? null);
			else if (event.key === 'End') this.#choose(this.visibleRows().at(-1) ?? null);
			else if (event.key === 'Enter') this.activate();
			else return;
			event.preventDefault();
		});
		// The header keeps a 16px spacer over the scrollbar only while the bar shows (SHeaderRow.cpp:734-741).
		this.on(this, 'ue-scrollbar-visibility', (event) => {
			const spacer = this.one('.hr-spacer');
			if (spacer) spacer.hidden = !(event as CustomEvent<ScrollbarVisibilityDetail>).detail.visible;
		});
		this.on(this, 'ue-sort', (event) => {
			const detail = (event as CustomEvent<SortDetail>).detail;
			if (detail.column !== 'name') return;
			this.#descending = detail.direction === 'descending';
			this.#sort();
		});
	}

	// The text filter. A row shows while its name contains the text, ignoring case.
	get query(): string {
		return this.#query;
	}

	set query(text: string) {
		this.#query = text;
		this.#refresh();
	}

	// Engine content (a path under /Engine/) shows only while this is true.
	get showEngine(): boolean {
		return this.#showEngine;
	}

	set showEngine(show: boolean) {
		this.#showEngine = show;
		this.toggleAttribute('show-engine', show);
		this.#refresh();
	}

	// The id of the selected row, or null.
	get selectedId(): string | null {
		const row = this.#all().find((each) => each.getAttribute('aria-selected') === 'true');
		return row ? this.#idOf(row) : null;
	}

	// The object path of the row with this id, or null.
	pathOf(id: string): string | null {
		return this.#all().find((row) => this.#idOf(row) === id)?.dataset.path ?? null;
	}

	// The rows the filters leave, in order.
	visibleRows(): HTMLElement[] {
		return this.#all().filter((row) => !row.hidden);
	}

	// Selects the row with this id, or clears the selection for null or an unknown id. Fires no event.
	select(id: string | null): void {
		const row = this.#all().find((each) => this.#idOf(each) === id) ?? null;
		this.#mark(row);
		this.#reveal(row);
	}

	// Moves the selection by `delta` through the visible rows, wrapping, as SAssetView::AdjustActiveSelection does.
	// With no selection the first row is selected.
	move(delta: number): void {
		const rows = this.visibleRows();
		if (rows.length === 0) {
			this.#choose(null);
			return;
		}
		const at = rows.findIndex((row) => row.getAttribute('aria-selected') === 'true');
		const next = at < 0 ? 0 : (at + delta + rows.length) % rows.length;
		this.#choose(rows[next]);
	}

	// Activates the selected visible row, or the first visible row when none is selected. Returns the id, or null for an empty list.
	activate(): string | null {
		const rows = this.visibleRows();
		const row = rows.find((each) => each.getAttribute('aria-selected') === 'true') ?? rows[0];
		if (!row) return null;
		this.#choose(row);
		const id = this.#idOf(row);
		this.emit<AssetListActivateDetail>('ue-asset-list-activate', { id });
		return id;
	}

	// Replaces every row with rows drawn from data.
	setItems(items: AssetItem[]): void {
		this.#rows.replaceChildren(...items.map((item) => this.#draw(item)));
		this.#sort();
	}

	// Looked up on each use, so an owner may call the API before this element's own setup runs.
	get #rows(): HTMLElement {
		const rows = this.one('.AssetList__rows');
		if (!rows) throw new Error('ue-asset-list needs a .AssetList__rows listbox');
		return rows;
	}

	get #count(): HTMLElement | null {
		return this.one('.AssetList__count');
	}

	#all(): HTMLElement[] {
		return Array.from(this.#rows.querySelectorAll<HTMLElement>(':scope > ' + ROW));
	}

	#rowAt(target: EventTarget | null): HTMLElement | null {
		const row = target instanceof Element ? target.closest<HTMLElement>(ROW) : null;
		return row && row.parentElement === this.#rows ? row : null;
	}

	#idOf(row: HTMLElement): string {
		return row.dataset.id ?? (row.querySelector('.AssetList__name')?.textContent ?? '').trim();
	}

	#mark(row: HTMLElement | null): void {
		for (const each of this.#all()) each.setAttribute('aria-selected', String(each === row));
		this.#writeCount();
	}

	// Scrolls only the list view so the row shows, as RequestScrollIntoView does. The page itself never scrolls.
	#reveal(row: HTMLElement | null): void {
		const view = this.#rows.closest<HTMLElement>('.sb-view');
		if (!row || row.hidden || !view) return;
		const box = view.getBoundingClientRect();
		const at = row.getBoundingClientRect();
		if (at.top < box.top) view.scrollTop -= box.top - at.top;
		else if (at.bottom > box.bottom) view.scrollTop += at.bottom - box.bottom;
	}

	// Selects a row and announces the change.
	#choose(row: HTMLElement | null): void {
		const before = this.selectedId;
		this.#mark(row);
		this.#reveal(row);
		const id = row ? this.#idOf(row) : null;
		if (id !== before) this.emit<AssetListSelectDetail>('ue-asset-list-select', { id });
	}

	// Applies the filters, restripes the visible rows and rewrites the count line (SAssetView::GetAssetCountText, SAssetView.cpp:5513-5543).
	#refresh(): void {
		const text = this.#query.trim().toLowerCase();
		let shown = 0;
		for (const row of this.#all()) {
			const name = (row.querySelector('.AssetList__name')?.textContent ?? '').toLowerCase();
			const engine = (row.dataset.path ?? '').startsWith('/Engine/');
			row.hidden = (engine && !this.#showEngine) || (text !== '' && !name.includes(text));
			if (row.hidden) {
				if (row.getAttribute('aria-selected') === 'true') row.setAttribute('aria-selected', 'false');
				continue;
			}
			row.classList.toggle('is-odd', shown % 2 === 1);
			shown++;
		}
		this.#writeCount();
	}

	#writeCount(): void {
		if (!this.#count) return;
		const rows = this.visibleRows();
		const selected = rows.filter((row) => row.getAttribute('aria-selected') === 'true').length;
		const items = rows.length === 1 ? '1 item' : rows.length + ' items';
		this.#count.textContent = selected === 0 ? items : items + ' (' + selected + ' selected)';
	}

	#sort(): void {
		const rows = this.#all();
		const name = (row: HTMLElement): string => (row.querySelector('.AssetList__name')?.textContent ?? '').trim();
		rows.sort((a, b) => name(a).localeCompare(name(b)) * (this.#descending ? -1 : 1));
		this.#rows.append(...rows);
		this.#refresh();
	}

	#draw(item: AssetItem): HTMLElement {
		const row = document.createElement('div');
		row.className = 'AssetList__row';
		row.dataset.id = item.id;
		if (item.path) row.dataset.path = item.path;
		row.setAttribute('role', 'option');
		row.setAttribute('aria-selected', 'false');
		row.innerHTML = '<span class="AssetList__rc"></span><span class="AssetList__thumb"><span class="AssetList__glyph"></span><i class="AssetList__strip"></i></span><span class="AssetList__text"><span class="AssetList__name"></span><span class="AssetList__class"></span></span>';
		const name = row.querySelector('.AssetList__name');
		if (name) name.textContent = item.label;
		const kind = row.querySelector('.AssetList__class');
		if (kind) kind.textContent = item.typeLabel ?? '';
		const holder = row.querySelector('.AssetList__glyph');
		if (holder && item.thumb) {
			const image = document.createElement('img');
			image.className = 'AssetList__image';
			image.src = item.thumb;
			image.alt = '';
			holder.replaceWith(image);
		} else if (holder) {
			holder.insertAdjacentHTML('afterend', CUBE);
			holder.remove();
		}
		if (item.strip) row.querySelector<HTMLElement>('.AssetList__strip')?.style.setProperty('--strip', item.strip);
		return row;
	}
}

define('ue-asset-list', AssetListElement);
