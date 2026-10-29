// <ue-combo-button> wraps one or more .combobutton-anchor blocks (button plus popup list) and makes them open, navigate and pick.
import { UeElement, define } from '../_shared/element.ts';
import './ComboButton.css';

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
	}
}

define('ue-combo-button', UeComboButtonElement);
