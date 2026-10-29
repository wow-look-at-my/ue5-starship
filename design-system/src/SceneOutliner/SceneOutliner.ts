// <ue-scene-outliner> composes a search box, a sortable header, a tree in a scroll box and a status line. It only coordinates them.
import { UeElement, define } from '../_shared/element.ts';
import type { SortDetail } from '../HeaderRow/HeaderRow.ts';
import type { ScrollbarVisibilityDetail } from '../Scrollbar/Scrollbar.ts';
import type { TreeRow, TreeRowInfo } from '../TreeRow/TreeRow.ts';
import '../Button/Button.ts';
import '../HeaderRow/HeaderRow.ts';
import '../Scrollbar/Scrollbar.ts';
import '../TextInput/TextInput.ts';
import '../TreeRow/TreeRow.ts';

const ROW = '.so-row';
const SORTABLE = '.hr-cell[aria-sort]';

interface SortKey {
	column: string;
	direction: 1 | -1;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export class SceneOutliner extends UeElement {
	protected setup(): void {
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
			status.classList.add(shown === 0 ? 'is-none' : 'is-match');
			if (shown === 0) status.textContent = 'No matching actors (' + total + ' total)';
			else if (shown === total) status.textContent = total + ' actors' + suffix;
			else status.textContent = 'Showing ' + shown + ' of ' + total + ' actors' + suffix;
		};

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
				if (!eye) continue;
				eye.classList.toggle('is-off', hide);
				eye.querySelector('use')?.setAttribute('href', hide ? '#so-eye-off' : '#so-eye');
			}
		});

		updateStatus();
	}
}

define('ue-scene-outliner', SceneOutliner);
