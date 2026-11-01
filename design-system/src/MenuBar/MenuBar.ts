<<<<<<< HEAD
// <ue-menu-bar> wraps a .menuBar strip whose .menuBar-item siblings are followed by a .menuBar-menu.
import { UeElement, define } from '../_shared/element.ts';
import { enabledRows, moveRowFocus, rowLabel } from '../_shared/popup.ts';

const ITEM = '.menuBar-item';
const ROW = '.menuBar-row';
const MENU = '.menuBar-menu';

type RowTarget = 'first' | 'last' | 'none';

export class MenuBar extends UeElement {
	protected setup(): void {
		const items = (): HTMLElement[] => this.all(ITEM);
		const openItem = (): HTMLElement | null => this.one(ITEM + '.is-open');
		const menuOf = (item: HTMLElement): HTMLElement | null => {
			const menu = item.nextElementSibling;
			return menu instanceof HTMLElement && menu.matches(MENU) ? menu : null;
		};
		const itemOf = (menu: Element): HTMLElement | null => {
			const item = menu.previousElementSibling;
			return item instanceof HTMLElement && item.matches(ITEM) ? item : null;
		};
		const setCurrent = (item: HTMLElement): void => {
			for (const other of items()) other.tabIndex = other === item ? 0 : -1;
		};

		const close = (restoreFocus: boolean): void => {
			const item = openItem();
			if (!item) return;
			item.classList.remove('is-open');
			item.setAttribute('aria-expanded', 'false');
			if (restoreFocus) item.focus();
		};

		const open = (item: HTMLElement, rows: RowTarget): void => {
			const menu = menuOf(item);
			if (!menu) return;
			for (const other of items()) {
				if (other === item) continue;
				other.classList.remove('is-open');
				other.setAttribute('aria-expanded', 'false');
			}
			item.classList.add('is-open');
			item.setAttribute('aria-expanded', 'true');
			setCurrent(item);
			if (rows === 'none') return;
			const list = enabledRows(menu, ROW);
			if (list.length > 0) (rows === 'first' ? list[0] : list[list.length - 1]).focus();
		};

		const step = (item: HTMLElement, delta: number): HTMLElement => {
			const list = items();
			return list[(list.indexOf(item) + delta + list.length) % list.length];
		};

		this.on(this, 'pointerdown', (event) => {
			const target = event.target;
			if (!(target instanceof Element) || event.button !== 0) return;
			const item = target.closest<HTMLElement>(ITEM);
			if (!item || !this.contains(item)) return;
			if (item.classList.contains('is-open')) close(false);
			else open(item, 'none');
		});

		this.on(this, 'pointerover', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const row = target.closest<HTMLElement>(ROW);
			if (row) {
				if (row.getAttribute('aria-disabled') !== 'true') row.focus({ preventScroll: true });
				return;
			}
			const item = target.closest<HTMLElement>(ITEM);
			if (item && openItem() && !item.classList.contains('is-open')) open(item, 'none');
		});

		this.on(this, 'click', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const row = target.closest<HTMLElement>(ROW);
			if (!row || row.getAttribute('aria-disabled') === 'true') return;
			this.emit('ue-menu-select', { label: rowLabel(row, '.menuBar-label') });
			close(true);
=======
// <ue-menu-bar> wraps a .menuBar strip of ue-combo-button menus. It moves between them: hover and Left and Right switch the open menu.
import { UeElement, define } from '../_shared/element.ts';
import type { UeComboButtonElement } from '../ComboButton/ComboButton.ts';
import '../ComboButton/ComboButton.ts';
import './MenuBar.css';

const TRIGGER = '.combobutton';
const PANEL = '.combobutton-menu';
const CURRENT_ROW = '.popupmenu__row--hover';

export class MenuBar extends UeElement {
	protected setup(): void {
		const combos = (): UeComboButtonElement[] => this.all<UeComboButtonElement>('ue-combo-button');
		const triggerOf = (combo: Element): HTMLElement | null => combo.querySelector<HTMLElement>(TRIGGER);
		const openCombo = (): UeComboButtonElement | undefined => combos().find((combo) => combo.isOpen);
		const setCurrent = (trigger: HTMLElement): void => {
			for (const other of combos()) {
				const own = triggerOf(other);
				if (own) own.tabIndex = own === trigger ? 0 : -1;
			}
		};
		const step = (combo: UeComboButtonElement, delta: number): UeComboButtonElement => {
			const list = combos();
			return list[(list.indexOf(combo) + delta + list.length) % list.length];
		};
		// Closes the open menu and opens `next`. `keys` puts the focus on its first row.
		const moveTo = (from: UeComboButtonElement | undefined, next: UeComboButtonElement, keys: boolean): void => {
			from?.close(false);
			next.open(keys, false);
			const trigger = triggerOf(next);
			if (trigger) setCurrent(trigger);
		};

		this.on(this, 'pointerover', (event) => {
			const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>(TRIGGER) : null;
			const combo = trigger?.closest<UeComboButtonElement>('ue-combo-button');
			const open = openCombo();
			if (combo && open && open !== combo) moveTo(open, combo, false);
		});

		this.on(this, 'focusin', (event) => {
			const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>(TRIGGER) : null;
			if (trigger) setCurrent(trigger);
		});

		this.on(this, 'ue-combo-pick', (event) => {
			this.emit('ue-menu-select', { label: (event as CustomEvent<{ label: string }>).detail.label });
>>>>>>> claude/adoring-faraday-94vc0i
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
<<<<<<< HEAD
			if (!(target instanceof HTMLElement)) return;
			const key = event.key;
			const row = target.closest<HTMLElement>(ROW);
			const item = row ? itemOf(row.closest<HTMLElement>(MENU) ?? row) : target.closest<HTMLElement>(ITEM);
			if (!item) return;

			if (key === 'Escape') {
				if (!openItem()) return;
				event.preventDefault();
				close(true);
				return;
			}
			if (key === 'Tab') {
				close(false);
				return;
			}
			if (key === 'ArrowRight' || key === 'ArrowLeft') {
				event.preventDefault();
				const next = step(item, key === 'ArrowRight' ? 1 : -1);
				if (row) open(next, 'first');
				else {
					next.focus();
					setCurrent(next);
					if (openItem()) open(next, 'none');
				}
				return;
			}
			if (row) {
				if (moveRowFocus(enabledRows(row.closest(MENU) ?? row, ROW), row, key)) event.preventDefault();
				else if (key === 'Enter' || key === ' ') {
					event.preventDefault();
					row.click();
				}
				return;
			}
			if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {
				event.preventDefault();
				open(item, 'first');
			} else if (key === 'ArrowUp') {
				event.preventDefault();
				open(item, 'last');
			}
		});

		this.on(document, 'pointerdown', (event) => {
			if (event.target instanceof Node && !this.contains(event.target)) close(false);
=======
			if (!(target instanceof HTMLElement) || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
			const combo = target.closest<UeComboButtonElement>('ue-combo-button');
			if (!combo) return;
			const inPanel = target.closest(PANEL) !== null;
			if (inPanel) {
				const current = combo.querySelector(CURRENT_ROW);
				if (event.key === 'ArrowRight' && current?.hasAttribute('aria-haspopup')) return;
				if (event.key === 'ArrowLeft' && current?.closest('.popupmenu__sub')) return;
			} else if (target !== triggerOf(combo)) {
				return;
			}
			event.preventDefault();
			const next = step(combo, event.key === 'ArrowRight' ? 1 : -1);
			const open = openCombo();
			if (inPanel || open) {
				moveTo(open, next, inPanel);
				return;
			}
			const trigger = triggerOf(next);
			if (!trigger) return;
			trigger.focus();
			setCurrent(trigger);
>>>>>>> claude/adoring-faraday-94vc0i
		});
	}
}

define('ue-menu-bar', MenuBar);
