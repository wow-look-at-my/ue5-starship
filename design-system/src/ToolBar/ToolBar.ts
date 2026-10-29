// <ue-tool-bar> wraps a .toolBar strip of ue-button and ue-combo-button controls. It drives the Play group and the arrow keys between controls.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ComboButton/ComboButton.ts';

const CONTROL = '.button, .combobutton';
const PANEL = '.combobutton-menu';

function isDisabled(el: Element): boolean {
	return el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true';
}

export class ToolBar extends UeElement {
	protected setup(): void {
		const buttonIn = (bar: Element, plate: string): HTMLButtonElement | null => bar.querySelector<HTMLButtonElement>(plate + ' .button');

		const setPlaying = (bar: Element, playing: boolean): void => {
			const play = buttonIn(bar, '.toolBar-plate--play');
			const stop = buttonIn(bar, '.toolBar-plate--stop');
			if (!play || !stop) return;
			play.setAttribute('aria-pressed', String(playing));
			stop.disabled = !playing;
			if (bar instanceof HTMLElement) bar.dataset.playing = String(playing);
			this.emit('ue-play-change', { playing });
		};

		for (const stop of this.all('.toolBar-plate--stop')) {
			const bar = stop.closest('.toolBar');
			if (bar) setPlaying(bar, bar.getAttribute('data-playing') === 'true');
		}

		this.on(this, 'ue-button-click', (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const bar = target.closest('.toolBar');
			if (!bar) return;
			if (target.closest('.toolBar-plate--play')) {
				// ue-button flips aria-pressed on every click. Playing stays pressed until Stop.
				if (bar.getAttribute('data-playing') !== 'true') setPlaying(bar, true);
				else buttonIn(bar, '.toolBar-plate--play')?.setAttribute('aria-pressed', 'true');
			} else if (target.closest('.toolBar-plate--stop')) {
				setPlaying(bar, false);
			}
		});

		this.on(this, 'ue-combo-pick', (event) => {
			this.emit('ue-menu-select', { label: (event as CustomEvent<{ label: string }>).detail.label });
		});

		this.on(this, 'keydown', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement) || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
			const control = target.closest<HTMLElement>(CONTROL);
			const bar = control?.closest('.toolBar');
			if (!control || !bar || control.closest(PANEL)) return;
			const list = Array.from(bar.querySelectorAll<HTMLElement>(CONTROL)).filter((c) => !c.closest(PANEL) && !isDisabled(c));
			const next = list[(list.indexOf(control) + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
			event.preventDefault();
			next.focus();
		});
	}
}

define('ue-tool-bar', ToolBar);
