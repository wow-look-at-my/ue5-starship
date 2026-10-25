// <ue-details-header> wraps the DetailsHeader markup: lock toggle and the editable actor name.
import { UeElement, define } from '../_shared/element.ts';

class UeDetailsHeader extends UeElement {
	protected setup(): void {
		const lock = this.one<HTMLButtonElement>('.DetailsHeader-lock');
		const label = this.one<HTMLElement>('.DetailsHeader-label');
		if (lock) this.on(lock, 'click', () => this.setLocked(lock, lock.getAttribute('aria-pressed') !== 'true'));
		if (label) this.wireLabel(label);
	}

	private setLocked(lock: HTMLElement, locked: boolean): void {
		lock.setAttribute('aria-pressed', String(locked));
		lock.querySelector('use')?.setAttribute('href', locked ? '#DetailsHeader-locked' : '#DetailsHeader-unlock');
	}

	// Enter commits, Escape restores the text from before the edit. The instance row shows the committed name.
	private wireLabel(label: HTMLElement): void {
		let before = label.textContent ?? '';
		this.on(label, 'focus', () => {
			before = label.textContent ?? '';
		});
		this.on(label, 'keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				label.blur();
			} else if (event.key === 'Escape') {
				label.textContent = before;
				label.blur();
			}
		});
		this.on(label, 'blur', () => {
			const text = (label.textContent ?? '').trim();
			label.textContent = text === '' ? before : text;
			for (const name of this.all('.DetailsHeader-instance .name')) name.textContent = label.textContent;
		});
	}
}

define('ue-details-header', UeDetailsHeader);
