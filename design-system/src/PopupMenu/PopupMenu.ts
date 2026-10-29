// <ue-popup-menu> wraps one .popupmenu list. One row at a time is current,
// the hovered or keyboard row.
import { UeElement, define } from '../_shared/element.ts';
import { ownedBy } from '../_shared/own.ts';
import { enabledRows, rowLabel } from '../_shared/popup.ts';
import './PopupMenu.css';

const ROW = '.popupmenu__row';
const CURRENT = 'popupmenu__row--hover';
const OPEN = 'popupmenu__row--open';
const PRESSED = 'popupmenu__row--pressed';
const KEYS = 'popupmenu--keys';

function rowOf(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>(ROW) : null;
}

function isDisabled(row: HTMLElement): boolean {
	return row.getAttribute('aria-disabled') === 'true';
}

function submenuOf(row: HTMLElement): HTMLElement | null {
	return row.querySelector<HTMLElement>(':scope > .popupmenu__sub');
}

// The menu element that directly holds a row.
function menuOf(row: HTMLElement): HTMLElement | null {
	return row.parentElement;
}

export interface MenuActivateDetail {
	label: string;
	role: string | null;
	// Null for a plain row.
	checked: boolean | null;
	// The label, plus the new state for a check or radio row.
	text: string;
	// The data-value attribute of the row, or its label.
	value: string;
	row: HTMLElement;
}

export class UePopupMenuElement extends UeElement {
	// The focusable .popupmenu list.
	get root(): HTMLElement {
		const root = this.one('.popupmenu[tabindex]');
		if (!root) throw new Error('ue-popup-menu needs a .popupmenu[tabindex] element');
		return root;
	}

	// Focuses the list and marks `row` current. `keys` hides the hover highlight, as after an arrow key.
	focusMenu(row: HTMLElement | null, keys: boolean): void {
		const root = this.root;
		root.focus({ preventScroll: true });
		root.classList.toggle(KEYS, keys);
		this.#show(root, row, null);
	}

	// Clears the current row and closes every submenu.
	reset(): void {
		const root = this.root;
		root.classList.remove(KEYS);
		this.#show(root, null, null);
	}

	// The enabled rows of the top level, in order.
	topRows(): HTMLElement[] {
		return enabledRows(this.root, ':scope > ' + ROW);
	}

	protected setup(): void {
		void this.root;

		this.on(this, 'mousemove', (event) => {
			const row = rowOf(event.target);
			if (!row || !ownedBy(this, event.target)) return;
			const root = this.root;
			root.classList.remove(KEYS);
			if (isDisabled(row)) return;
			const sub = submenuOf(row);
			const open = sub !== null && !sub.hidden;
			if (row.classList.contains(CURRENT) && (sub === null || open)) return;
			this.#show(root, row, sub ? row : null);
		});

		this.on(this, 'pointerdown', (event) => {
			const row = rowOf(event.target);
			if (row && ownedBy(this, event.target) && event.button === 0 && !isDisabled(row)) row.classList.add(PRESSED);
		});
		const release = (): void => {
			for (const row of this.all(ROW + '.' + PRESSED)) row.classList.remove(PRESSED);
		};
		this.on(this, 'pointerup', release);
		this.on(this, 'pointercancel', release);
		this.on(this, 'pointerout', (event) => {
			const row = rowOf(event.target);
			if (row && !(event.relatedTarget instanceof Node && row.contains(event.relatedTarget))) row.classList.remove(PRESSED);
		});

		this.on(this, 'click', (event) => {
			const row = rowOf(event.target);
			if (!row || !ownedBy(this, event.target) || isDisabled(row)) return;
			const sub = submenuOf(row);
			if (sub) {
				this.#show(this.root, row, sub.hidden ? row : null);
				return;
			}
			this.#show(this.root, row, null);
			this.#activate(row);
		});

		this.on(this, 'mouseout', (event) => {
			const root = this.root;
			if (!ownedBy(this, event.target) || (event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) return;
			if (!root.classList.contains(KEYS)) this.#show(root, null, null);
		});

		this.on(this, 'keydown', (event) => {
			if (event.target === this.root) this.#key(event, this.root);
		});

		this.on(this, 'focusout', (event) => {
			const root = this.root;
			if (!root.contains(event.target as Node)) return;
			if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) this.#show(root, null, null);
		});
	}

	// Marks one row current, opens the submenus on its path, and optionally opens the submenu of `open`.
	#show(root: HTMLElement, current: HTMLElement | null, open: HTMLElement | null): void {
		const keep = new Set<HTMLElement>();
		for (let row: HTMLElement | null = current; row; row = row.parentElement?.closest<HTMLElement>(ROW) ?? null) {
			if (row !== current) keep.add(row);
		}
		if (open) keep.add(open);
		for (const row of Array.from(root.querySelectorAll<HTMLElement>(ROW))) {
			row.classList.toggle(CURRENT, row === current);
			const sub = submenuOf(row);
			if (sub) {
				const isOpen = keep.has(row);
				sub.hidden = !isOpen;
				row.classList.toggle(OPEN, isOpen);
				row.setAttribute('aria-expanded', String(isOpen));
			}
		}
	}

	#activate(row: HTMLElement): void {
		const role = row.getAttribute('role');
		const label = rowLabel(row, '.popupmenu__label');
		let checked: boolean | null = null;
		let text = label;
		if (role === 'menuitemcheckbox') {
			checked = row.getAttribute('aria-checked') !== 'true';
			row.setAttribute('aria-checked', String(checked));
			text += checked ? ' (checked)' : ' (unchecked)';
		} else if (role === 'menuitemradio') {
			for (const other of Array.from(menuOf(row)?.querySelectorAll<HTMLElement>(':scope > [role="menuitemradio"]') ?? [])) {
				other.setAttribute('aria-checked', String(other === row));
			}
			checked = true;
			text += ' (selected)';
		}
		const detail: MenuActivateDetail = { label, role, checked, text, value: row.dataset.value ?? label, row };
		this.emit('ue-menu-activate', detail);
	}

	#key(event: KeyboardEvent, root: HTMLElement): void {
		const current = root.querySelector<HTMLElement>(ROW + '.' + CURRENT);
		const menu = current ? menuOf(current) : root;
		if (!menu) return;
		const rows = enabledRows(menu, ':scope > ' + ROW);
		const index = current ? rows.indexOf(current) : -1;
		const go = (next: HTMLElement | undefined): void => {
			root.classList.add(KEYS);
			if (next) this.#show(root, next, null);
		};
		switch (event.key) {
			case 'ArrowDown': go(rows[index < 0 ? 0 : (index + 1) % rows.length]); break;
			case 'ArrowUp': go(rows[index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length]); break;
			case 'Home': go(rows[0]); break;
			case 'End': go(rows[rows.length - 1]); break;
			case 'ArrowRight': this.#enter(root, current); break;
			case 'ArrowLeft': this.#leave(root, current); break;
			case 'Escape':
				root.classList.add(KEYS);
				if (current && menu !== root) {
					this.#leave(root, current);
					event.stopPropagation();
				} else {
					this.#show(root, null, null);
				}
				break;
			case 'Enter':
			case ' ':
				root.classList.add(KEYS);
				if (event.repeat || !current) break;
				if (submenuOf(current)) this.#enter(root, current);
				else this.#activate(current);
				break;
			default: return;
		}
		event.preventDefault();
	}

	// Opens the submenu of the current row and moves to its first enabled row.
	#enter(root: HTMLElement, current: HTMLElement | null): void {
		root.classList.add(KEYS);
		const sub = current ? submenuOf(current) : null;
		if (!current || !sub) return;
		const first = enabledRows(sub, ':scope > ' + ROW)[0];
		this.#show(root, first ?? current, current);
	}

	// Closes the submenu that holds the current row and returns to its parent row.
	#leave(root: HTMLElement, current: HTMLElement | null): void {
		root.classList.add(KEYS);
		const parent = current ? (menuOf(current)?.closest<HTMLElement>(ROW) ?? null) : null;
		if (parent) this.#show(root, parent, null);
	}
}

define('ue-popup-menu', UePopupMenuElement);
