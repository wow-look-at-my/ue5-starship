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
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
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
		});
	}
}

define('ue-menu-bar', MenuBar);
