<<<<<<< HEAD
// <ue-combo-button> wraps one or more .combobutton-anchor blocks (button plus popup list) and makes them open, navigate and pick.
import { UeElement, define } from '../_shared/element.ts';

const ITEM = '.combobutton-row-item';
const HOT = 'combobutton-row-item--hover';
const RING = 'combobutton-row-item--focus';
const KEYS = 'combobutton-menu--keys';
const OPEN = 'combobutton--open';

interface Parts {
	anchor: HTMLElement;
	trigger: HTMLElement;
	menu: HTMLElement;
}

function partsOf(node: Element | null): Parts | null {
	const anchor = node?.closest<HTMLElement>('.combobutton-anchor') ?? null;
	const trigger = anchor?.querySelector<HTMLElement>(':scope > .combobutton') ?? null;
	const menu = anchor?.querySelector<HTMLElement>(':scope > .combobutton-menu') ?? null;
	return anchor && trigger && menu ? { anchor, trigger, menu } : null;
}

export class UeComboButtonElement extends UeElement {
	protected setup(): void {
		for (const anchor of this.all('.combobutton-anchor')) {
			const parts = partsOf(anchor);
			if (parts && !parts.trigger.classList.contains('combobutton--simple')) this.#markSelected(parts, this.#labelOf(parts));
		}

		this.on(this, 'click', (event) => {
			if (!(event.target instanceof Element)) return;
			const item = event.target.closest<HTMLElement>(ITEM);
			if (item) {
				const parts = partsOf(item);
				if (parts) this.#choose(parts, item);
				return;
			}
			const trigger = event.target.closest<HTMLElement>('.combobutton');
			const parts = partsOf(trigger);
			if (!trigger || !parts || trigger.getAttribute('aria-disabled') === 'true') return;
			if (parts.menu.hidden) this.#open(parts);
			else this.#close(parts, false);
		});

		// Keep keyboard focus on the button while the pointer works the list.
		this.on(this, 'mousedown', (event) => {
			if (event.target instanceof Element && event.target.closest('.combobutton-menu')) event.preventDefault();
		});

		this.on(this, 'mousemove', (event) => {
			if (!(event.target instanceof Element)) return;
			const item = event.target.closest<HTMLElement>(ITEM);
			const parts = partsOf(item);
			if (!item || !parts) return;
			parts.menu.classList.remove(KEYS);
			this.#highlight(parts, item, false);
		});

		this.on(this, 'keydown', (event) => {
			if (!(event.target instanceof Element)) return;
			const trigger = event.target.closest<HTMLElement>('.combobutton');
			const parts = partsOf(trigger);
			if (!trigger || !parts || trigger !== parts.trigger || trigger.getAttribute('aria-disabled') === 'true') return;
			this.#key(event, parts);
		});

		this.on(document, 'pointerdown', (event) => {
			for (const anchor of this.all('.combobutton-anchor')) {
				const parts = partsOf(anchor);
				if (parts && !parts.menu.hidden && !(event.target instanceof Node && anchor.contains(event.target))) this.#close(parts, false);
			}
		});
	}

	#items(parts: Parts): HTMLElement[] {
		return Array.from(parts.menu.querySelectorAll<HTMLElement>(ITEM));
	}

	#labelOf(parts: Parts): string {
		return parts.trigger.querySelector('.combobutton__label')?.textContent?.trim() ?? '';
	}

	#markSelected(parts: Parts, label: string): void {
		for (const item of this.#items(parts)) item.setAttribute('aria-selected', String(item.textContent?.trim() === label));
	}

	#highlight(parts: Parts, item: HTMLElement | null, ring: boolean): void {
		for (const other of this.#items(parts)) {
			other.classList.toggle(HOT, other === item);
			other.classList.toggle(RING, other === item && ring);
		}
	}

	#open(parts: Parts): void {
		for (const anchor of this.all('.combobutton-anchor')) {
			const other = partsOf(anchor);
			if (other && other.anchor !== parts.anchor && !other.menu.hidden) this.#close(other, false);
		}
		parts.menu.hidden = false;
		parts.menu.classList.remove(KEYS);
		parts.trigger.classList.add(OPEN);
		parts.trigger.setAttribute('aria-expanded', 'true');
		this.#highlight(parts, null, false);
	}

	#close(parts: Parts, refocus: boolean): void {
		parts.menu.hidden = true;
		parts.trigger.classList.remove(OPEN);
		parts.trigger.setAttribute('aria-expanded', 'false');
		this.#highlight(parts, null, false);
		if (refocus) parts.trigger.focus();
	}

	#choose(parts: Parts, item: HTMLElement): void {
		const text = item.textContent?.trim() ?? '';
		const label = parts.trigger.querySelector('.combobutton__label');
		if (!parts.trigger.classList.contains('combobutton--simple')) {
			if (label) label.textContent = text;
			this.#markSelected(parts, text);
		}
		const status = this.one('.combobutton-status');
		if (status) status.textContent = 'Picked: ' + text;
		this.#close(parts, true);
		this.emit('ue-combo-pick', { value: text });
	}

	#key(event: KeyboardEvent, parts: Parts): void {
		const items = this.#items(parts);
		const current = items.findIndex((item) => item.classList.contains(HOT));
		const move = (index: number): void => {
			parts.menu.classList.add(KEYS);
			this.#highlight(parts, items[index] ?? null, true);
		};
		if (parts.menu.hidden) {
			if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
				event.preventDefault();
				this.#open(parts);
				const selected = items.findIndex((item) => item.getAttribute('aria-selected') === 'true');
				move(selected >= 0 ? selected : event.key === 'ArrowUp' ? items.length - 1 : 0);
			}
			return;
		}
		switch (event.key) {
			case 'ArrowDown': move(current < 0 ? 0 : (current + 1) % items.length); break;
			case 'ArrowUp': move(current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length); break;
			case 'Home': move(0); break;
			case 'End': move(items.length - 1); break;
			case 'Enter':
			case ' ':
				if (current >= 0) this.#choose(parts, items[current]);
				else this.#close(parts, true);
				break;
			case 'Escape': this.#close(parts, true); break;
			case 'Tab': this.#close(parts, false); return;
			default: return;
		}
		event.preventDefault();
=======
// <ue-combo-button> is one trigger and its dropdown panel.
import { UeElement, define } from '../_shared/element.ts';
import { ownedBy } from '../_shared/own.ts';
import { rowLabel } from '../_shared/popup.ts';
import type { MenuActivateDetail, UePopupMenuElement } from '../PopupMenu/PopupMenu.ts';
import '../PopupMenu/PopupMenu.ts';
import './ComboButton.css';

const OPEN = 'combobutton--open';
const ACTIVATE_KEYS = ['Enter', ' ', 'ArrowDown', 'ArrowUp'];

export class UeComboButtonElement extends UeElement {
	#trigger!: HTMLElement;
	#panel!: HTMLElement;

	// In value mode: the value of the picked row. The setter picks the row whose value or label matches, shows its label and fires no ue-combo-pick. This is because the owner that sets it
	// already knows.
	get value(): string {
		const picked = this.querySelector<HTMLElement>('.popupmenu__row[aria-selected="true"]');
		return picked?.dataset.value ?? (picked ? rowLabel(picked, '.popupmenu__label') : '');
	}

	set value(next: string) {
		const row = this.querySelectorAll<HTMLElement>('.popupmenu[tabindex] > .popupmenu__row');
		const match = Array.from(row).find((each) => (each.dataset.value ?? rowLabel(each, '.popupmenu__label')) === next);
		if (!match) throw new Error('ue-combo-button has no row with the value ' + next);
		const label = this.querySelector<HTMLElement>('.combobutton__label');
		if (label) label.textContent = rowLabel(match, '.popupmenu__label');
		for (const each of row) each.setAttribute('aria-selected', String(each === match));
	}

	protected setup(): void {
		const trigger = this.one('.combobutton');
		const panel = this.one('.combobutton-menu');
		if (!trigger || !panel) throw new Error('ue-combo-button needs a .combobutton trigger and a .combobutton-menu panel');
		if (!panel.querySelector('ue-popup-menu')) throw new Error('the .combobutton-menu panel needs a ue-popup-menu');
		this.#trigger = trigger;
		this.#panel = panel;
		const anchor = trigger.closest('.combobutton-anchor') ?? this;
		if (!this.#isAction()) this.#markSelected(this.#labelText());

		this.on(trigger, 'click', () => {
			if (this.#disabled()) return;
			if (panel.hidden) this.#open(false, false);
			else this.#close(false);
		});

		this.on(trigger, 'keydown', (event) => {
			if (event.target !== trigger || this.#disabled() || !ACTIVATE_KEYS.includes(event.key)) return;
			event.preventDefault();
			if (panel.hidden && !event.repeat) this.#open(true, event.key === 'ArrowUp');
		});

		// Keep the focus where it is while the pointer works the panel.
		this.on(panel, 'mousedown', (event) => event.preventDefault());

		this.on(panel, 'keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				this.#close(true);
			} else if (event.key === 'Tab') {
				this.#close(false);
			}
		});

		this.on(this, 'ue-menu-activate', (event) => {
			if (ownedBy(this, event.target)) this.#pick((event as CustomEvent<MenuActivateDetail>).detail);
		});

		this.on(document, 'pointerdown', (event) => {
			if (!panel.hidden && !(event.target instanceof Node && anchor.contains(event.target))) this.#close(false);
		});
	}

	// True while the panel shows.
	get isOpen(): boolean {
		return !this.#panel.hidden;
	}

	// Opens the panel. `keys` moves the focus into the list, `fromEnd` starts at the last row.
	open(keys = false, fromEnd = false): void {
		if (this.#disabled() || this.isOpen) return;
		this.#open(keys, fromEnd);
	}

	// Closes the panel. `refocus` returns the focus to the trigger.
	close(refocus = false): void {
		if (this.isOpen) this.#close(refocus);
	}

	#disabled(): boolean {
		return this.#trigger.getAttribute('aria-disabled') === 'true';
	}

	// Action mode keeps the label fixed. Value mode shows the picked row. mode="value" gives a simple trigger value mode.
	#isAction(): boolean {
		const mode = this.getAttribute('mode');
		if (mode === 'action' || this.#label() === null) return true;
		return mode !== 'value' && this.#trigger.classList.contains('combobutton--simple');
	}

	#label(): HTMLElement | null {
		return this.#trigger.querySelector<HTMLElement>('.combobutton__label');
	}

	#labelText(): string {
		return this.#label()?.textContent?.trim() ?? '';
	}

	// The popup menu is upgraded by its own module, which can load after this.
	#popup(): UePopupMenuElement {
		const popup = this.#panel.querySelector<UePopupMenuElement>('ue-popup-menu');
		if (!popup || typeof popup.focusMenu !== 'function') throw new Error('ue-popup-menu is not defined');
		return popup;
	}

	#rows(): HTMLElement[] {
		return Array.from(this.#panel.querySelectorAll<HTMLElement>('.popupmenu[tabindex] > .popupmenu__row')).filter((row) => row.getAttribute('aria-disabled') !== 'true');
	}

	#markSelected(label: string): void {
		for (const row of this.#rows()) row.setAttribute('aria-selected', String(rowLabel(row, '.popupmenu__label') === label));
	}

	#open(keys: boolean, fromEnd: boolean): void {
		const popup = this.#popup();
		this.#panel.hidden = false;
		this.#trigger.classList.add(OPEN);
		this.#trigger.setAttribute('aria-expanded', 'true');
		const rows = this.#rows();
		const selected = rows.find((row) => row.getAttribute('aria-selected') === 'true' || row.getAttribute('aria-checked') === 'true');
		popup.focusMenu(keys ? (selected ?? (fromEnd ? rows[rows.length - 1] : rows[0]) ?? null) : null, keys);
	}

	#close(refocus: boolean): void {
		this.#panel.hidden = true;
		this.#trigger.classList.remove(OPEN);
		this.#trigger.setAttribute('aria-expanded', 'false');
		this.#popup().reset();
		if (refocus) this.#trigger.focus();
	}

	#pick(detail: MenuActivateDetail): void {
		const label = this.#label();
		if (!this.#isAction() && label && detail.role !== 'menuitemcheckbox') {
			label.textContent = detail.label;
			this.#markSelected(detail.label);
		}
		this.#close(true);
		this.emit('ue-combo-pick', { value: detail.value, label: detail.label, checked: detail.checked });
>>>>>>> claude/adoring-faraday-94vc0i
	}
}

define('ue-combo-button', UeComboButtonElement);
