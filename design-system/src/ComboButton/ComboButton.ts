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

	#disabled(): boolean {
		return this.#trigger.getAttribute('aria-disabled') === 'true';
	}

	// Action mode keeps the label fixed. Value mode shows the picked row.
	#isAction(): boolean {
		return this.#trigger.classList.contains('combobutton--simple') || this.getAttribute('mode') === 'action' || this.#label() === null;
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
	}
}

define('ue-combo-button', UeComboButtonElement);
