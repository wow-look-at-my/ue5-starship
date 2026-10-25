// <ue-source-panel> wraps one .SourcePanel: collapsible sections, a keyboard-driven folder tree, toggle search buttons, add-collection.
import { UeElement, define } from '../_shared/element.ts';

const ROW = '.SourcePanel__row';
const SELECTED = 'SourcePanel__row--selected';
const PARENT = 'SourcePanel__row--parent';
const INDENT_PX = 10;

class SourcePanelElement extends UeElement {
	#root!: HTMLElement;

	protected setup(): void {
		const root = this.one('.SourcePanel');
		if (!root) throw new Error('ue-source-panel needs a .SourcePanel child');
		this.#root = root;
		root.setAttribute('role', 'group');
		for (const title of this.all('.SourcePanel__title')) {
			const area = title.closest('.SourcePanel__area');
			const body = area?.querySelector<HTMLElement>('.SourcePanel__body');
			title.setAttribute('role', 'button');
			title.tabIndex = 0;
			title.setAttribute('aria-expanded', String(body ? !body.hidden : false));
		}
		for (const control of this.all('.SourcePanel__tool, .SourcePanel__add')) {
			control.setAttribute('role', 'button');
			control.tabIndex = 0;
			if (control.classList.contains('SourcePanel__tool')) control.setAttribute('aria-pressed', 'false');
		}
		for (const tree of this.all('.SourcePanel__tree')) this.#initTree(tree);
		this.on(root, 'click', (event) => this.#click(event));
		this.on(root, 'dblclick', (event) => this.#doubleClick(event));
		this.on(root, 'keydown', (event) => this.#keydown(event));
	}

	#rows(tree: Element): HTMLElement[] {
		return Array.from(tree.querySelectorAll<HTMLElement>(ROW));
	}

	#visible(tree: Element): HTMLElement[] {
		return this.#rows(tree).filter((row) => !row.hidden);
	}

	#depth(row: HTMLElement): number {
		const indent = row.querySelector<HTMLElement>('.SourcePanel__indent');
		const px = indent ? parseFloat(indent.style.width) : 0;
		return Math.round((Number.isNaN(px) ? 0 : px) / INDENT_PX);
	}

	#hasKids(row: HTMLElement): boolean {
		return row.querySelector('.SourcePanel__exp svg') !== null;
	}

	#isOpen(row: HTMLElement): boolean {
		return row.getAttribute('aria-expanded') === 'true';
	}

	#treeOf(row: HTMLElement): HTMLElement | null {
		return row.closest<HTMLElement>('.SourcePanel__tree');
	}

	#initTree(tree: HTMLElement): void {
		tree.setAttribute('role', 'tree');
		for (const row of this.#rows(tree)) {
			row.setAttribute('role', 'treeitem');
			row.setAttribute('aria-level', String(this.#depth(row) + 1));
			row.setAttribute('aria-selected', String(row.classList.contains(SELECTED)));
			if (this.#hasKids(row)) {
				const href = row.querySelector('.SourcePanel__exp use')?.getAttribute('href') ?? '';
				row.setAttribute('aria-expanded', String(/caret-d$/.test(href)));
			}
		}
		this.#rove(tree);
	}

	// Exactly one row per tree takes the Tab stop: the selected row, else the first visible row.
	#rove(tree: HTMLElement): void {
		const visible = this.#visible(tree);
		const stop = visible.find((row) => row.classList.contains(SELECTED)) ?? visible[0];
		for (const row of this.#rows(tree)) row.tabIndex = row === stop ? 0 : -1;
	}

	#swap(element: Element | null, from: RegExp, to: string): void {
		const use = element?.querySelector('use');
		const href = use?.getAttribute('href');
		if (use && href) use.setAttribute('href', href.replace(from, to));
	}

	#select(row: HTMLElement, focus: boolean): void {
		for (const other of this.all(ROW)) {
			other.classList.remove(SELECTED, PARENT);
			other.setAttribute('aria-selected', 'false');
		}
		row.classList.add(SELECTED);
		row.setAttribute('aria-selected', 'true');
		const tree = this.#treeOf(row);
		if (tree) {
			const rows = this.#rows(tree);
			let level = this.#depth(row);
			for (let i = rows.indexOf(row) - 1; i >= 0 && level > 0; i--) {
				const depth = this.#depth(rows[i]);
				if (depth < level) {
					rows[i].classList.add(PARENT);
					level = depth;
				}
			}
		}
		for (const each of this.all<HTMLElement>('.SourcePanel__tree')) this.#rove(each);
		if (focus) row.focus();
		const name = row.querySelector('.SourcePanel__name')?.textContent ?? '';
		this.emit('sourcepanel:select', { name });
	}

	#setOpen(row: HTMLElement, open: boolean): void {
		const tree = this.#treeOf(row);
		if (!tree || !this.#hasKids(row) || this.#isOpen(row) === open) return;
		row.setAttribute('aria-expanded', String(open));
		this.#swap(row.querySelector('.SourcePanel__exp'), /caret-[rd]$/, open ? 'caret-d' : 'caret-r');
		this.#swap(row.querySelector('.SourcePanel__folder'),/-f[oc]$/, open ? '-fo' : '-fc');
		const rows = this.#rows(tree);
		const depth = this.#depth(row);
		let skipBelow: number | null = null;
		let selectedHidden = false;
		for (let i = rows.indexOf(row) + 1; i < rows.length; i++) {
			const child = rows[i];
			const childDepth = this.#depth(child);
			if (childDepth <= depth) break;
			if (skipBelow !== null && childDepth > skipBelow) {
				child.hidden = true;
				continue;
			}
			skipBelow = null;
			child.hidden = !open;
			if (!open && child.classList.contains(SELECTED)) selectedHidden = true;
			if (open && this.#hasKids(child) && !this.#isOpen(child)) skipBelow = childDepth;
		}
		if (!open && !selectedHidden) selectedHidden = rows.some((each) => each.hidden && each.classList.contains(SELECTED));
		if (selectedHidden) this.#select(row, true);
		else this.#rove(tree);
	}

	#setSection(area: Element, open: boolean): void {
		const body = area.querySelector<HTMLElement>('.SourcePanel__body');
		const title = area.querySelector<HTMLElement>('.SourcePanel__title');
		if (!body) return;
		body.hidden = !open;
		title?.setAttribute('aria-expanded', String(open));
		this.#swap(area.querySelector('.SourcePanel__header .SourcePanel__arrow'), /caret-[rd]$/, open ? 'caret-d' : 'caret-r');
	}

	#click(event: MouseEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		if (!target) return;
		const tool = target.closest<HTMLElement>('.SourcePanel__tool');
		if (tool) {
			tool.setAttribute('aria-pressed', String(tool.getAttribute('aria-pressed') !== 'true'));
			return;
		}
		if (target.closest('.SourcePanel__add')) {
			this.#addCollection(target.closest('.SourcePanel__area'));
			return;
		}
		const header = target.closest('.SourcePanel__header');
		if (header) {
			const area = header.closest('.SourcePanel__area');
			const body = area?.querySelector<HTMLElement>('.SourcePanel__body');
			if (area && body) this.#setSection(area, body.hidden);
			return;
		}
		const row = target.closest<HTMLElement>(ROW);
		if (!row) return;
		if (target.closest('.SourcePanel__exp')) {
			this.#setOpen(row, !this.#isOpen(row));
			return;
		}
		this.#select(row, true);
	}

	#doubleClick(event: MouseEvent): void {
		const row = event.target instanceof Element ? event.target.closest<HTMLElement>(ROW) : null;
		if (row && !(event.target as Element).closest('.SourcePanel__exp')) this.#setOpen(row, !this.#isOpen(row));
	}

	#addCollection(area: Element | null): void {
		const tree = area?.querySelector<HTMLElement>('.SourcePanel__tree');
		if (!area || !tree) return;
		this.#setSection(area, true);
		const rows = this.#rows(tree);
		const row = document.createElement('div');
		row.className = 'SourcePanel__row' + (rows.length === 0 ? ' SourcePanel__row--root' : '');
		row.innerHTML = '<span class="SourcePanel__indent" style="width:0"></span><span class="SourcePanel__exp"></span><svg class="SourcePanel__folder"><use href="#sp-fc"/></svg><span class="SourcePanel__name"></span>';
		const name = row.querySelector('.SourcePanel__name');
		if (name) name.textContent = 'NewCollection' + (rows.length + 1);
		row.setAttribute('role', 'treeitem');
		row.setAttribute('aria-level', '1');
		row.setAttribute('aria-selected', 'false');
		tree.append(row);
		this.#select(row, true);
	}

	#keydown(event: KeyboardEvent): void {
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (!target) return;
		const activate = event.key === 'Enter' || event.key === ' ';
		if (activate && target.matches('.SourcePanel__title, .SourcePanel__tool, .SourcePanel__add')) {
			event.preventDefault();
			target.click();
			return;
		}
		if (!target.matches(ROW)) return;
		const tree = this.#treeOf(target);
		if (!tree) return;
		const visible = this.#visible(tree);
		const at = visible.indexOf(target);
		const depth = this.#depth(target);
		let go: HTMLElement | undefined;
		switch (event.key) {
			case 'ArrowDown':
				go = visible[at + 1];
				break;
			case 'ArrowUp':
				go = visible[at - 1];
				break;
			case 'Home':
				go = visible[0];
				break;
			case 'End':
				go = visible[visible.length - 1];
				break;
			case 'ArrowRight':
				if (this.#hasKids(target) && !this.#isOpen(target)) this.#setOpen(target, true);
				else if (this.#isOpen(target)) go = visible[at + 1];
				break;
			case 'ArrowLeft':
				if (this.#isOpen(target)) this.#setOpen(target, false);
				else go = visible.slice(0, at).reverse().find((row) => this.#depth(row) < depth);
				break;
			case 'Enter':
			case ' ':
				go = target;
				break;
			default:
				return;
		}
		event.preventDefault();
		if (go) this.#select(go, true);
	}
}

define('ue-source-panel', SourcePanelElement);
