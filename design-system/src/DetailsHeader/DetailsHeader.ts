// <ue-details-header> wraps the Details name area: class icon, editable actor
// name, Add, Blueprint, help and lock buttons, and the instance row.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import './DetailsHeader.css';

class UeDetailsHeader extends UeElement {
	protected setup(): void {
		const label = this.one<HTMLElement>('.DetailsHeader-label');
		if (label) this.wireLabel(label);
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
