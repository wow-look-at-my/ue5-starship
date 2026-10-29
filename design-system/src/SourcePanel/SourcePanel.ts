// <ue-source-panel> wraps one .SourcePanel. Its sections are ue-expandable-area, its trees are ue-tree-row and its tool buttons are ue-button. The panel keeps one selection across all trees.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ExpandableArea/ExpandableArea.ts';
import { TreeRow, type TreeRowData, type TreeSelectDetail } from '../TreeRow/TreeRow.ts';
import './SourcePanel.css';

export interface SourcePanelSelectDetail {
	id: string;
	name: string;
}

export class SourcePanelElement extends UeElement {
	#trees: TreeRow[] = [];
	#collections = 0;

	protected setup(): void {
		this.#trees = this.all<TreeRow>('ue-tree-row').filter((tree) => this.owns(tree));
		this.#collections = this.#tree('collections')?.querySelectorAll('.tr-row').length ?? 0;
		for (const area of this.#areas()) this.#markCollapsed(area);

		this.on(this, 'ue-tree-select', (event) => {
			const tree = event.target;
			if (!this.owns(tree) || !(tree instanceof TreeRow)) return;
			const [id] = (event as CustomEvent<TreeSelectDetail>).detail.ids;
			if (id === undefined) return;
			for (const other of this.#trees) if (other !== tree) other.select([]);
			const name = tree.querySelector('.tr-row.is-selected .tr-text')?.textContent ?? '';
			this.emit<SourcePanelSelectDetail>('sourcepanel:select', { id, name });
		});
		this.on(this, 'ue-expand-toggle', (event) => {
			if (!this.owns(event.target)) return;
			const area = (event.target as Element).querySelector<HTMLElement>('.SourcePanel__area');
			if (area) this.#markCollapsed(area);
		});
		this.on(this, 'ue-button-click', (event) => {
			if (!this.owns(event.target)) return;
			if ((event.target as HTMLElement).dataset.action === 'add-collection') this.#addCollection();
		});
	}

	// Replaces the rows of the tree named by its `data-tree` attribute.
	setRows(tree: string, rows: TreeRowData[]): void {
		this.#tree(tree)?.setRows(rows);
	}

	// Selects the row with this id in whichever tree holds it. The other trees lose their selection.
	select(id: string): void {
		for (const tree of this.#trees) tree.select([id]);
	}

	// Opens or closes the row with this id.
	setExpanded(id: string, expanded: boolean): void {
		for (const tree of this.#trees) tree.setExpanded(id, expanded);
	}

	#tree(name: string): TreeRow | undefined {
		return this.#trees.find((tree) => tree.dataset.tree === name);
	}

	#areas(): HTMLElement[] {
		return this.all('.SourcePanel__area').filter((area) => this.owns(area));
	}

	// The area class `is-collapsed` lets a filling area give its height back.
	#markCollapsed(area: HTMLElement): void {
		area.classList.toggle('is-collapsed', area.querySelector('.expandablearea__header')?.getAttribute('aria-expanded') !== 'true');
	}

	#addCollection(): void {
		const tree = this.#tree('collections');
		if (!tree) return;
		const header = tree.closest('.SourcePanel__area')?.querySelector<HTMLElement>('.expandablearea__header');
		if (header?.getAttribute('aria-expanded') !== 'true') header?.click();
		const label = 'NewCollection' + (this.#collections + 1);
		this.#collections++;
		const id = 'Collections/' + label;
		tree.appendRow({ id, label, icon: 'folder', depth: 0 });
		this.select(id);
	}
}

define('ue-source-panel', SourcePanelElement);
