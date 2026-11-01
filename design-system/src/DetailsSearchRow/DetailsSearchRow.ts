// <ue-details-search-row> wraps a Details search row: a ue-text-input search
// box, a favorites toggle and the view options menu. The primitives own the
// typing, the clear button, the toggle and the menu.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ComboButton/ComboButton.ts';
import '../TextInput/TextInput.ts';
import './DetailsSearchRow.css';

class UeDetailsSearchRow extends UeElement {
	protected setup(): void {
		this.on(this, 'ue-text-input', (event) => {
			if (this.owns(event.target)) this.emit('ue-search', { text: (event as CustomEvent<{ value: string }>).detail.value });
		});

		this.on(this, 'ue-button-click', (event) => {
			const star = this.owns(event.target) ? (event.target as Element).querySelector<HTMLElement>('[data-role="favorites"]') : null;
			if (!star) return;
			const on = (event as CustomEvent<{ pressed: boolean | null }>).detail.pressed === true;
			star.title = on ? 'Toggle Favorites (on)' : 'Toggle Favorites';
			this.emit('ue-favorites', { on });
		});

		this.on(this, 'ue-combo-pick', (event) => {
			if (!this.owns(event.target)) return;
			const { value, checked } = (event as CustomEvent<{ value: string; checked: boolean | null }>).detail;
			this.emit('ue-view-option', { option: value, checked: checked === true });
		});
	}
}

define('ue-details-search-row', UeDetailsSearchRow);
