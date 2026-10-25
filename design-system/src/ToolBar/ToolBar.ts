// <ue-tool-bar> wraps a .toolBar strip: toggles, combo menus and the Play group.
import { UeElement, define } from '../_shared/element.ts';
import { enabledRows, moveRowFocus, rowLabel } from '../_shared/popup.ts';

const CONTROL = '.toolBar-btn, .toolBar-modes, .toolBar-wrap, .toolBar-plate';
const TOGGLE = '.toolBar-btn--toggle';
const MENU = '.toolBar-menu';
const ROW = '.toolBar-row';

type RowTarget = 'first' | 'last' | 'none';

function isDisabled(el: Element): boolean {
	return el.getAttribute('aria-disabled') === 'true';
}

export class ToolBar extends UeElement {
	protected setup(): void {
		const menuOf = (control: Element): HTMLElement | null => {
			const slot = control.closest('.toolBar-slot');
			return slot ? slot.querySelector<HTMLElement>(':scope > ' + MENU) : null;
		};
		const controlOf = (menu: Element): HTMLElement | null => {
			const slot = menu.closest('.toolBar-slot');
			return slot ? slot.querySelector<HTMLElement>(CONTROL) : null;
		};
		const openMenu = (): HTMLElement | null => this.one(MENU + '.is-open');

		const close = (restoreFocus: boolean): void => {
			const menu = openMenu();
			if (!menu) return;
			menu.classList.remove('is-open');
			const control = controlOf(menu);
			if (!control) return;
			control.setAttribute('aria-expanded', 'false');
			if (restoreFocus) control.focus();
		};

		const open = (control: HTMLElement, rows: RowTarget): void => {
			const menu = menuOf(control);
			if (!menu) return;
			close(false);
			menu.classList.add('is-open');
			control.setAttribute('aria-expanded', 'true');
			if (rows === 'none') return;
			const list = enabledRows(menu, ROW);
			if (list.length > 0) (rows === 'first' ? list[0] : list[list.length - 1]).focus();
		};

		const setPlaying = (bar: Element, playing: boolean): void => {
			const play = bar.querySelector<HTMLElement>('.toolBar-plate--play');
			const stop = bar.querySelector<HTMLElement>('.toolBar-plate--stop');
			if (!play || !stop) return;
			play.classList.toggle('is-pressed', playing);
			play.setAttribute('aria-pressed', String(playing));
			stop.classList.toggle('is-disabled', !playing);
			stop.setAttribute('aria-disabled', String(!playing));
			stop.tabIndex = playing ? 0 : -1;
			if (bar instanceof HTMLElement) bar.dataset.playing = String(playing);
			this.emit('ue-play-change', { playing });
		};

		for (const stop of this.all('.toolBar-plate--stop')) {
			const bar = stop.closest('.toolBar');
			if (bar) setPlaying(bar, bar.getAttribute('data-playing') === 'true');
		}

		this.on(this, 'click', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const row = target.closest<HTMLElement>(ROW);
			if (row) {
				if (isDisabled(row)) return;
				this.emit('ue-menu-select', { label: rowLabel(row, '.toolBar-label') });
				close(true);
				return;
			}
			const control = target.closest<HTMLElement>(CONTROL);
			if (!control || isDisabled(control)) return;
			if (control.matches(TOGGLE)) {
				const checked = control.classList.toggle('is-checked');
				control.setAttribute('aria-pressed', String(checked));
			}
			if (menuOf(control)) {
				if (control.getAttribute('aria-expanded') === 'true') close(false);
				else open(control, 'none');
				return;
			}
			const bar = control.closest('.toolBar');
			if (!bar) return;
			if (control.matches('.toolBar-plate--play') && bar.getAttribute('data-playing') !== 'true') setPlaying(bar, true);
			else if (control.matches('.toolBar-plate--stop')) setPlaying(bar, false);
		});

		this.on(this, 'pointerover', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const row = target.closest<HTMLElement>(ROW);
			if (row && !isDisabled(row)) row.focus({ preventScroll: true });
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const key = event.key;
			const row = target.closest<HTMLElement>(ROW);
			if (row) {
				if (key === 'Escape') {
					event.preventDefault();
					close(true);
				} else if (key === 'Tab') close(false);
				else if (moveRowFocus(enabledRows(row.closest(MENU) ?? row, ROW), row, key)) event.preventDefault();
				else if (key === 'Enter' || key === ' ') {
					event.preventDefault();
					row.click();
				}
				return;
			}
			const control = target.closest<HTMLElement>(CONTROL);
			if (!control) return;
			if (key === 'Escape') {
				if (!openMenu()) return;
				event.preventDefault();
				close(true);
			} else if (key === 'Enter' || key === ' ') {
				event.preventDefault();
				control.click();
			} else if ((key === 'ArrowDown' || key === 'ArrowUp') && menuOf(control)) {
				event.preventDefault();
				open(control, key === 'ArrowDown' ? 'first' : 'last');
			} else if (key === 'ArrowRight' || key === 'ArrowLeft') {
				const bar = control.closest('.toolBar');
				if (!bar) return;
				const list = Array.from(bar.querySelectorAll<HTMLElement>(CONTROL)).filter((c) => !isDisabled(c));
				const next = list[(list.indexOf(control) + (key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
				event.preventDefault();
				close(false);
				next.focus();
			}
		});

		this.on(document, 'pointerdown', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const menu = openMenu();
			if (!menu || menu.contains(target)) return;
			const control = controlOf(menu);
			if (control && control.contains(target)) return;
			close(false);
		});
	}
}

define('ue-tool-bar', ToolBar);
