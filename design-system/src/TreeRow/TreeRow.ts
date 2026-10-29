// <ue-tree-row> wraps a .tr-tree whose .tr-row children are a flat list; the depth of a row is its aria-level.
import { UeElement, define } from '../_shared/element.ts';
import { TreeController } from '../_shared/tree-controller.ts';
import './TreeRow.css';

const ARROW = '<svg class="tr-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4.5 4L6 12z"/></svg>';
const FOLDER = '<svg class="tr-icon is-folder" viewBox="0 0 16 16" aria-hidden="true"><path class="tr-folder-closed" d="M1.5 4.5V12a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.8 3.5H2.5a1 1 0 0 0-1 1z"/><path class="tr-folder-open" d="M1.5 4.5V12a1 1 0 0 0 1 1h10.6l1.9-5.2a.8.8 0 0 0-.75-1.1H5.2L3.8 11V4.5a1 1 0 0 1 1-1h2L8 5h5.5"/></svg>';
const OBJECT = '<svg class="tr-icon is-object" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l5.5 3.1v6.2L8 14.2 2.5 11.1V4.9zM2.5 4.9L8 8l5.5-3.1M8 8v6.2"/></svg>';

export interface TreeRowData {
	id: string;
	label: string;
	// Defaults to a set limit.
	depth?: number;
	// 'folder' draws the folder icon, 'object' the cube, 'none' no icon. Defaults to 'object'.
	icon?: 'folder' | 'object' | 'none';
	// Shows the expander arrow although no child row follows, for children that load later.
	expandable?: boolean;
	// Initial expanded state. Defaults to false.
	expanded?: boolean;
	selected?: boolean;
	// Draws the label in the non-interactive grey.
	dim?: boolean;
	// Text of extra column cells after the label.
	cells?: string[];
}

export interface TreeSelectDetail {
	ids: string[];
}

export interface TreeToggleDetail {
	id: string;
	expanded: boolean;
}

export interface TreeRowInfo {
	id: string;
	label: string;
	depth: number;
	// The row element, for a consumer that reads its own cells.
	element: HTMLElement;
}

export type TreeFilter = string | ((row: TreeRowInfo) => boolean) | null;

export class TreeRow extends UeElement {
	#tree: HTMLElement | null = null;
	#controller: TreeController | null = null;
	#filter: ((row: TreeRowInfo) => boolean) | null = null;
	#kept = new Set<HTMLElement>();
	#parentsOfKept = new Set<HTMLElement>();
	#lastIds = '';

	protected setup(): void {
		const tree = this.#ownTree() ?? this.#createTree();
		this.#tree = tree;
		tree.setAttribute('role', 'tree');
		tree.setAttribute('aria-multiselectable', String(!this.#single()));
		const controller = new TreeController(
			tree,
			{
				row: '.tr-row',
				arrow: '.tr-arrow',
				folder: '.tr-icon.is-folder',
				caretOpen: '',
				caretClosed: '',
				folderOpen: '',
				folderClosed: '',
				openClass: 'is-open',
			},
			{
				multi: !this.#single(),
				excluded: (row) => this.#filter !== null && !this.#kept.has(row),
				forceOpen: (row) => this.#filter !== null && this.#parentsOfKept.has(row),
				lazy: (row) => row.dataset.expandable === 'true',
				toggled: (row, open) => {
					this.emit<TreeToggleDetail>('ue-tree-toggle', { id: this.#idOf(row), expanded: open });
					if (!open && this.hasAttribute('collapse-selects') && this.#rows().some((each) => each.hidden && this.#controller?.isSelected(each))) this.select([this.#idOf(row)]);
				},
				selected: () => this.#announceSelection(),
			},
		);
		this.#controller = controller;

		// A click inside [data-tr-inert] belongs to a control in a cell. It changes no selection and opens nothing.
		const live = (target: EventTarget | null): boolean => this.owns(target) && !(target as Element).closest('[data-tr-inert]');
		this.on(tree, 'click', (event) => {
			if (live(event.target)) controller.click(event);
		});
		this.on(tree, 'dblclick', (event) => {
			if (live(event.target)) controller.doubleClick(event);
		});
		this.on(tree, 'keydown', (event) => {
			if (this.owns(event.target)) controller.keyDown(event);
		});
		this.#lastIds = this.getSelectedIds().join('\n');
		controller.refresh();
	}

	#single(): boolean {
		return this.getAttribute('select') === 'single';
	}

	// The first tree below this element that no nested instance owns.
	#ownTree(): HTMLElement | null {
		return this.all('.tr-tree').find((tree) => tree.closest(this.localName) === this) ?? null;
	}

	#createTree(): HTMLElement {
		const tree = document.createElement('div');
		tree.className = 'tr-tree';
		this.append(tree);
		return tree;
	}

	#rows(): HTMLElement[] {
		return this.#controller?.rows() ?? [];
	}

	#idOf(row: HTMLElement): string {
		return row.dataset.id ?? (row.querySelector('.tr-text')?.textContent ?? '').trim();
	}

	#rowOf(id: string): HTMLElement | undefined {
		return this.#rows().find((row) => this.#idOf(row) === id);
	}

	#info(row: HTMLElement): TreeRowInfo {
		return { id: this.#idOf(row), label: (row.querySelector('.tr-text')?.textContent ?? '').trim(), depth: (this.#controller?.level(row) ?? 1) - 1, element: row };
	}

	#announceSelection(): void {
		const ids = this.getSelectedIds();
		const key = ids.join('\n');
		if (key === this.#lastIds) return;
		this.#lastIds = key;
		this.emit<TreeSelectDetail>('ue-tree-select', { ids });
	}

	// Ids of the selected rows in tree order.
	getSelectedIds(): string[] {
		return this.#rows().filter((row) => row.classList.contains('is-selected')).map((row) => this.#idOf(row));
	}

	// Selects exactly these rows. Ids that name no row are ignored.
	select(ids: string[]): void {
		const controller = this.#controller;
		if (!controller) return;
		const wanted = new Set(this.#single() ? ids.slice(0, 1) : ids);
		const rows = this.#rows().filter((row) => wanted.has(this.#idOf(row)));
		controller.setSelection(rows, rows[rows.length - 1] ?? null);
	}

	// Opens or closes one row.
	setExpanded(id: string, expanded: boolean): void {
		const row = this.#rowOf(id);
		if (row && this.#controller?.hasChildren(row)) this.#controller.setOpen(row, expanded);
	}

	// Replaces every row with rows drawn from data.
	setRows(rows: TreeRowData[]): void {
		const tree = this.#tree;
		const controller = this.#controller;
		if (!tree || !controller) return;
		tree.replaceChildren(...rows.map((data) => this.#draw(data)));
		this.#lastIds = this.getSelectedIds().join('\n');
		this.#refilter();
		controller.refresh();
	}

	// Adds one row after the last row. It does not touch the selection.
	appendRow(data: TreeRowData): void {
		if (!this.#tree || !this.#controller) return;
		this.#tree.append(this.#draw(data));
		this.#refilter();
		this.#controller.refresh();
	}

	#draw(data: TreeRowData): HTMLElement {
		const depth = data.depth ?? 0;
		const row = document.createElement('div');
		row.className = 'tr-row' + (data.selected ? ' is-selected' : '') + (data.dim ? ' is-dim' : '');
		row.setAttribute('role', 'treeitem');
		row.setAttribute('aria-level', String(depth + 1));
		row.setAttribute('aria-expanded', data.expanded ? 'true' : 'false');
		row.dataset.id = data.id;
		if (data.expandable) row.dataset.expandable = 'true';
		const icon = data.icon ?? 'object';
		const cells = (data.cells ?? []).map(() => '<span class="tr-cell"></span>').join('');
		row.innerHTML = '<span class="tr-indent" style="--depth:' + depth + '"></span>' + ARROW + (icon === 'folder' ? FOLDER : icon === 'object' ? OBJECT : '') + '<span class="tr-text"></span>' + cells;
		const text = row.querySelector('.tr-text');
		if (text) text.textContent = data.label;
		const cellEls = row.querySelectorAll('.tr-cell');
		(data.cells ?? []).forEach((value, i) => {
			cellEls[i].textContent = value;
		});
		return row;
	}

	// Sorts the children of every parent with compare. A row keeps its subtree. Selection and open state stay.
	sortChildren(compare: (a: TreeRowInfo, b: TreeRowInfo) => number): void {
		const tree = this.#tree;
		const controller = this.#controller;
		if (!tree || !controller) return;
		interface Node {
			row: HTMLElement;
			kids: Node[];
		}
		const roots: Node[] = [];
		const stack: Node[] = [];
		for (const row of this.#rows()) {
			const node: Node = { row, kids: [] };
			const level = controller.level(row);
			stack.length = level - 1;
			(stack[level - 2]?.kids ?? roots).push(node);
			stack[level - 1] = node;
		}
		const flat: HTMLElement[] = [];
		const walk = (list: Node[]): void => {
			list.sort((a, b) => compare(this.#info(a.row), this.#info(b.row)));
			for (const node of list) {
				flat.push(node.row);
				walk(node.kids);
			}
		};
		walk(roots);
		tree.append(...flat);
		controller.refresh();
	}

	// Shows only the rows the filter accepts and their ancestors. Ancestors open while the filter is set. Null clears it.
	setFilter(filter: TreeFilter): void {
		if (typeof filter === 'string') {
			const needle = filter.trim().toLowerCase();
			this.#filter = needle === '' ? null : (row) => row.label.toLowerCase().includes(needle);
		} else {
			this.#filter = filter;
		}
		this.#refilter();
		this.#controller?.refresh();
	}

	#refilter(): void {
		this.#kept = new Set();
		this.#parentsOfKept = new Set();
		const filter = this.#filter;
		const controller = this.#controller;
		if (!filter || !controller) return;
		const rows = this.#rows();
		rows.forEach((row, index) => {
			if (!filter(this.#info(row))) return;
			this.#kept.add(row);
			let want = controller.level(row);
			for (let j = index - 1; j >= 0 && want > 1; j--) {
				const level = controller.level(rows[j]);
				if (level < want) {
					this.#kept.add(rows[j]);
					this.#parentsOfKept.add(rows[j]);
					want = level;
				}
			}
		});
	}
}

define('ue-tree-row', TreeRow);
