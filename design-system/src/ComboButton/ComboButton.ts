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
		const picked = this.#ownRows().find((row) => row.getAttribute('aria-selected') === 'true');
		return picked?.dataset.value ?? (picked ? rowLabel(picked, '.popupmenu__label') : '');
	}

	set value(next: string) {
		const row = this.#ownRows();
		const match = row.find((each) => (each.dataset.value ?? rowLabel(each, '.popupmenu__label')) === next);
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

		// Keep the focus where it is while the pointer works the panel. A widget block in the menu takes the focus like any form.
		this.on(panel, 'mousedown', (event) => {
			if (!this.#inWidget(event.target)) event.preventDefault();
		});

		this.on(panel, 'keydown', (event) => {
			if (event.key === 'Escape') {
				// A search field in a widget block clears itself first, and the menu stays open.
				if (event.defaultPrevented && event.target instanceof HTMLInputElement && this.#inWidget(event.target)) return;
				event.preventDefault();
				// A combo inside another menu closes alone.
				if (this.parentElement?.closest('.combobutton-menu')) event.stopPropagation();
				this.#close(true);
			} else if (event.key === 'Tab' && !this.#inWidget(event.target)) {
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

	// The top-level rows of this combo's own list. A combo nested in a widget block keeps its rows.
	#ownRows(): HTMLElement[] {
		const root = this.#panel.querySelector('ue-popup-menu .popupmenu[tabindex]');
		return root ? Array.from(root.querySelectorAll<HTMLElement>(':scope > .popupmenu__row')) : [];
	}

	#rows(): HTMLElement[] {
		return this.#ownRows().filter((row) => !row.hidden && row.getAttribute('aria-disabled') !== 'true');
	}

	// True when the target sits in a widget block (.popupmenu__widget) of this combo's own menu.
	#inWidget(target: EventTarget | null): boolean {
		const widget = target instanceof Element ? target.closest('.popupmenu__widget') : null;
		return widget !== null && widget.closest('.combobutton-menu') === this.#panel;
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
		// A field marked data-autofocus in a widget block takes the focus, as bFocusSearchBoxWhenOpened does (SAssetPicker.cpp:98-101).
		const field = Array.from(this.#panel.querySelectorAll<HTMLElement>('[data-autofocus]')).find((each) => this.#inWidget(each));
		field?.focus({ preventScroll: true });
		this.emit('ue-combo-toggle', { open: true });
	}

	#close(refocus: boolean): void {
		this.#panel.hidden = true;
		this.#trigger.classList.remove(OPEN);
		this.#trigger.setAttribute('aria-expanded', 'false');
		this.#popup().reset();
		if (refocus) this.#trigger.focus();
		this.emit('ue-combo-toggle', { open: false });
	}

	#pick(detail: MenuActivateDetail): void {
		const label = this.#label();
		if (!this.#isAction() && label && detail.role !== 'menuitemcheckbox') {
			label.textContent = detail.label;
			this.#markSelected(detail.label);
		}
		this.#close(true);
		this.emit('ue-combo-pick', { value: detail.value, label: detail.label, checked: detail.checked });
	}
}

define('ue-combo-button', UeComboButtonElement);
