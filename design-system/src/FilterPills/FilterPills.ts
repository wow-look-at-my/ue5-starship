// <ue-filter-pills> wraps the FilterPills markup: one active pill per strip, with roving keyboard focus.
import { UeElement, define } from '../_shared/element.ts';

class UeFilterPills extends UeElement {
	protected setup(): void {
		for (const strip of this.all('.FilterPills-strip')) {
			this.on(strip, 'click', (event) => {
				const pill = (event.target as Element).closest<HTMLElement>('.FilterPills-pill');
				if (pill && strip.contains(pill)) this.select(strip, pill, false);
			});
			this.on(strip, 'keydown', (event) => {
				const pills = Array.from(strip.querySelectorAll<HTMLElement>('.FilterPills-pill'));
				const at = pills.indexOf(document.activeElement as HTMLElement);
				if (at < 0) return;
				let next = -1;
				if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % pills.length;
				else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + pills.length) % pills.length;
				else if (event.key === 'Home') next = 0;
				else if (event.key === 'End') next = pills.length - 1;
				if (next < 0) return;
				event.preventDefault();
				this.select(strip, pills[next], true);
			});
		}
	}

	private select(strip: Element, pill: HTMLElement, focus: boolean): void {
		for (const other of strip.querySelectorAll<HTMLElement>('.FilterPills-pill')) {
			const on = other === pill;
			other.classList.toggle('is-checked', on);
			other.setAttribute('aria-selected', String(on));
			other.tabIndex = on ? 0 : -1;
		}
		if (focus) pill.focus();
		this.emit('ue-filter-change', { label: pill.textContent ?? '' });
	}
}

define('ue-filter-pills', UeFilterPills);
