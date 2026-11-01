<<<<<<< HEAD
// <ue-scene-outliner> composes a search box, a sortable header, a tree in a scroll box and a status line. It only coordinates them.
import { UeElement, define } from '../_shared/element.ts';
import type { SortDetail } from '../HeaderRow/HeaderRow.ts';
import type { ScrollbarVisibilityDetail } from '../Scrollbar/Scrollbar.ts';
import type { TreeRow, TreeRowInfo } from '../TreeRow/TreeRow.ts';
import '../Button/Button.ts';
import './SceneOutliner.css';
import '../HeaderRow/HeaderRow.ts';
import '../Scrollbar/Scrollbar.ts';
import '../TextInput/TextInput.ts';
import '../TreeRow/TreeRow.ts';

const ROW = '.so-row';
const SORTABLE = '.hr-cell[aria-sort]';

interface SortKey {
	column: string;
	direction: 1 | -1;
=======
// <ue-scene-outliner> wraps a .so-panel: search box, sortable header, a .so-rows tree with a .so-sb bar, and the status line.
import { UeElement, define } from '../_shared/element.ts';
import { TreeController } from '../_shared/tree-controller.ts';
import { bindBar } from '../_shared/scroll-thumb.ts';

const ROW = '.so-row';
const SORTABLE = '.so-hcell[aria-sort]';

type Mode = 'ascending' | 'descending' | 'none';

interface Node {
	row: HTMLElement;
	kids: Node[];
>>>>>>> origin/master
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export class SceneOutliner extends UeElement {
	protected setup(): void {
<<<<<<< HEAD
		const tree = this.one<TreeRow>('ue-tree-row');
		const status = this.one('.so-status');
		const spacer = this.one('.hr-spacer');
		if (!tree || !status) return;

		const rows = (): HTMLElement[] => this.all(ROW);
		const text = (row: HTMLElement, selector: string): string => row.querySelector(selector)?.textContent?.trim() ?? '';
		const label = (row: HTMLElement): string => text(row, '.tr-text');
		const kind = (row: HTMLElement): string => text(row, '.so-type');
		const isActor = (row: HTMLElement): boolean => kind(row) !== 'Folder' && kind(row) !== 'World';

		let needle = '';

		const updateStatus = (): void => {
			const actors = rows().filter(isActor);
			const total = actors.length;
			const selected = actors.filter((row) => row.getAttribute('aria-selected') === 'true').length;
			const suffix = selected > 0 ? ' (' + selected + ' selected)' : '';
			status.classList.remove('is-match', 'is-none');
			if (needle === '') {
				status.textContent = total + ' actors' + suffix;
				return;
			}
			const shown = actors.filter((row) => label(row).toLowerCase().includes(needle)).length;
=======
		const rowsEl = this.one('.so-rows');
		const input = this.one<HTMLInputElement>('.so-input');
		const clear = this.one('.so-clear');
		const status = this.one('.so-status');
		const bar = this.one('.so-sb');
		const thumb = this.one('.so-thumb');
		const hcells = this.one('.so-hcells');
		const spacer = this.one('.so-hspacer');
		if (!rowsEl || !input || !clear || !status || !bar || !thumb) return;

		const text = (row: HTMLElement, selector: string): string => row.querySelector(selector)?.textContent?.trim() ?? '';
		const label = (row: HTMLElement): string => text(row, '.so-text');
		const kind = (row: HTMLElement): string => text(row, '.so-type');
		const isActor = (row: HTMLElement): boolean => kind(row) !== 'Folder' && kind(row) !== 'World';

		// Rows the text filter keeps: each match and all its ancestors. Null while the filter is off.
		let keep: Set<HTMLElement> | null = null;
		let saved: Map<HTMLElement, string | null> | null = null;

		const updateStatus = (): void => {
			const actors = controller.rows().filter(isActor);
			const total = actors.length;
			const selected = actors.filter((row) => controller.isSelected(row)).length;
			const suffix = selected > 0 ? ' (' + selected + ' selected)' : '';
			status.classList.remove('is-match', 'is-none');
			if (!keep) {
				status.textContent = total + ' actors' + suffix;
				return;
			}
			const shown = actors.filter((row) => keep?.has(row)).length;
>>>>>>> origin/master
			status.classList.add(shown === 0 ? 'is-none' : 'is-match');
			if (shown === 0) status.textContent = 'No matching actors (' + total + ' total)';
			else if (shown === total) status.textContent = total + ' actors' + suffix;
			else status.textContent = 'Showing ' + shown + ' of ' + total + ' actors' + suffix;
		};

<<<<<<< HEAD
		this.on(this, 'ue-text-input', (event) => {
			needle = (event as CustomEvent<{ value: string }>).detail.value.trim().toLowerCase();
			tree.setFilter(needle);
			updateStatus();
		});
		this.on(this, 'ue-tree-select', updateStatus);
		this.on(this, 'ue-scrollbar-visibility', (event) => {
			if (spacer) spacer.hidden = !(event as CustomEvent<ScrollbarVisibilityDetail>).detail.visible;
		});

		// SSceneOutliner::SortItems: the primary key first, then the secondary key. Within a parent, folders come before actors.
		const keys: { primary?: SortKey; secondary?: SortKey } = {};
		const compareBy = (key: SortKey, a: TreeRowInfo, b: TreeRowInfo): number => {
			if (key.column === 'type') return key.direction * collator.compare(kind(a.element), kind(b.element));
			const byKind = Number(isActor(a.element)) - Number(isActor(b.element));
			return key.direction * (byKind || collator.compare(a.label, b.label));
		};
		const sortRows = (): void => {
			const chain = [keys.primary, keys.secondary].filter((key): key is SortKey => key !== undefined);
			tree.sortChildren((a, b) => {
				for (const key of chain) {
					const order = compareBy(key, a, b);
					if (order !== 0) return order;
				}
				return 0;
			});
		};
		const record = (column: string, mode: string, priority: string): void => {
			const key: SortKey = { column, direction: mode === 'descending' ? -1 : 1 };
			if (priority === 'secondary') keys.secondary = key;
			else keys.primary = key;
			if (priority === 'primary' && keys.secondary?.column === column) delete keys.secondary;
		};
		this.on(this, 'ue-sort', (event) => {
			const detail = (event as CustomEvent<SortDetail>).detail;
			record(detail.column, detail.mode, detail.priority);
			sortRows();
		});
		for (const cell of this.all(SORTABLE)) {
			const mode = cell.getAttribute('aria-sort') ?? 'none';
			if (mode !== 'none') record(cell.dataset.column ?? 'label', mode, cell.dataset.priority ?? 'primary');
		}
		if (keys.primary || keys.secondary) sortRows();

		// ArrowDown in the search box moves the focus to the row the tree would focus.
		this.on(this, 'keydown', (event) => {
			const source = event.target;
			if (event.key !== 'ArrowDown' || !(source instanceof HTMLElement) || !source.matches('.textinput__field')) return;
			const shown = rows().filter((row) => !row.hidden);
			const current = shown.find((row) => row.tabIndex === 0) ?? shown[0];
			if (!current) return;
			event.preventDefault();
			current.focus({ preventScroll: true });
			current.scrollIntoView({ block: 'nearest' });
		});

		// The eye toggles one item. On a folder it toggles everything below it as well.
		this.on(this, 'click', (event) => {
			const source = event.target;
			if (!(source instanceof Element) || !source.closest('.so-gutter')) return;
			const row = source.closest<HTMLElement>(ROW);
			if (!row) return;
			const all = rows();
			const level = (r: HTMLElement): number => Number(r.getAttribute('aria-level'));
			const start = all.indexOf(row);
			const hide = !row.querySelector('.so-eye')?.classList.contains('is-off');
			for (let i = start; i < all.length && (i === start || level(all[i]) > level(row)); i++) {
				const eye = all[i].querySelector('.so-eye');
=======
		const binding = bindBar(rowsEl, bar, thumb, true, (fits) => {
			if (spacer) spacer.hidden = fits;
			hcells?.classList.toggle('is-no-bar', fits);
		});
		this.onDispose(binding.dispose);

		const controller: TreeController = new TreeController(rowsEl, {
			row: ROW,
			arrow: '.so-arrow',
			folder: '.so-ico.is-folder',
			caretOpen: 'so-caret-down',
			caretClosed: 'so-caret-right',
			folderOpen: 'so-folder-open',
			folderClosed: 'so-folder',
		}, {
			excluded: (row) => keep !== null && !keep.has(row),
			changed: () => {
				updateStatus();
				binding.update();
			},
		});

		// Filter: keep matches and their ancestors, and open those ancestors. Clearing restores the open state from before.
		const applyFilter = (): void => {
			const needle = input.value.trim().toLowerCase();
			clear.hidden = input.value === '';
			if (needle === '') {
				if (saved) {
					for (const [row, value] of saved) {
						if (value === null) row.removeAttribute('aria-expanded');
						else row.setAttribute('aria-expanded', value);
					}
				}
				keep = null;
				saved = null;
				controller.refresh();
				return;
			}
			const rows = controller.rows();
			saved ??= new Map(rows.map((row) => [row, row.getAttribute('aria-expanded')]));
			const next = new Set<HTMLElement>();
			rows.forEach((row, index) => {
				if (!label(row).toLowerCase().includes(needle)) return;
				next.add(row);
				let want = controller.level(row);
				for (let j = index - 1; j >= 0 && want > 1; j--) {
					if (controller.level(rows[j]) < want) {
						next.add(rows[j]);
						rows[j].setAttribute('aria-expanded', 'true');
						want = controller.level(rows[j]);
					}
				}
			});
			keep = next;
			controller.refresh();
		};

		// Sorts the children of every parent by the column, like SSceneOutliner::SortItems.
		const sortRows = (column: string, mode: Mode): void => {
			const rows = controller.rows();
			const roots: Node[] = [];
			const stack: Node[] = [];
			for (const row of rows) {
				const node: Node = { row, kids: [] };
				const level = controller.level(row);
				stack.length = level - 1;
				(stack[level - 2]?.kids ?? roots).push(node);
				stack[level - 1] = node;
			}
			const dir = mode === 'descending' ? -1 : 1;
			const compare = (a: Node, b: Node): number => {
				if (column === 'type') return dir * collator.compare(kind(a.row), kind(b.row));
				const byKind = Number(isActor(a.row)) - Number(isActor(b.row));
				return dir * (byKind || collator.compare(label(a.row), label(b.row)));
			};
			const flat: HTMLElement[] = [];
			const walk = (list: Node[]): void => {
				list.sort(compare);
				for (const node of list) {
					flat.push(node.row);
					walk(node.kids);
				}
			};
			walk(roots);
			rowsEl.append(...flat);
			controller.refresh();
		};

		const paintHeader = (cell: HTMLElement, mode: Mode): void => {
			cell.setAttribute('aria-sort', mode);
			const arrow = cell.querySelector<SVGElement>('.so-sort');
			if (!arrow) return;
			arrow.toggleAttribute('hidden', mode === 'none');
			arrow.querySelector('use')?.setAttribute('href', mode === 'descending' ? '#so-down' : '#so-up');
		};
		const modeOf = (cell: HTMLElement): Mode => {
			const value = cell.getAttribute('aria-sort');
			return value === 'ascending' || value === 'descending' ? value : 'none';
		};
		const cells = (): HTMLElement[] => this.all(SORTABLE);

		// SHeaderRow.cpp:392-430: an unsorted column starts ascending, a sorted column flips.
		const activate = (cell: HTMLElement): void => {
			const mode: Mode = modeOf(cell) === 'ascending' ? 'descending' : 'ascending';
			for (const other of cells()) paintHeader(other, other === cell ? mode : 'none');
			sortRows(cell.dataset.column ?? 'label', mode);
		};

		this.on(this, 'click', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const cell = target.closest<HTMLElement>(SORTABLE);
			if (cell && this.contains(cell)) {
				activate(cell);
				return;
			}
			if (target.closest('.so-clear')) {
				input.value = '';
				applyFilter();
				input.focus();
			}
		});
		this.on(this, 'keydown', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement) || !target.matches(SORTABLE)) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			activate(target);
		});

		this.on(input, 'input', applyFilter);
		this.on(input, 'keydown', (event) => {
			if (event.key === 'Escape' && input.value !== '') {
				event.preventDefault();
				input.value = '';
				applyFilter();
			} else if (event.key === 'ArrowDown') {
				const current = controller.shown().find((row) => row.tabIndex === 0) ?? controller.shown()[0];
				if (!current) return;
				event.preventDefault();
				controller.focusRow(current, true);
			}
		});

		// The eye toggles one item. On a folder it toggles everything below it as well.
		const toggleEye = (row: HTMLElement): void => {
			const rows = controller.rows();
			const start = rows.indexOf(row);
			const hide = !row.querySelector('.so-eye')?.classList.contains('is-off');
			const level = controller.level(row);
			for (let i = start; i < rows.length && (i === start || controller.level(rows[i]) > level); i++) {
				const eye = rows[i].querySelector('.so-eye');
>>>>>>> origin/master
				if (!eye) continue;
				eye.classList.toggle('is-off', hide);
				eye.querySelector('use')?.setAttribute('href', hide ? '#so-eye-off' : '#so-eye');
			}
<<<<<<< HEAD
		});

		updateStatus();
=======
		};

		this.on(rowsEl, 'click', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const row = controller.rowOf(target);
			if (row && target.closest('.so-gutter')) {
				toggleEye(row);
				return;
			}
			controller.click(event);
		});
		this.on(rowsEl, 'dblclick', (event) => controller.doubleClick(event));
		this.on(rowsEl, 'keydown', (event) => {
			controller.keyDown(event);
		});

		const sorted = cells().find((cell) => modeOf(cell) !== 'none');
		for (const cell of cells()) paintHeader(cell, modeOf(cell));
		if (sorted) sortRows(sorted.dataset.column ?? 'label', modeOf(sorted));
		else controller.refresh();
>>>>>>> origin/master
	}
}

define('ue-scene-outliner', SceneOutliner);
