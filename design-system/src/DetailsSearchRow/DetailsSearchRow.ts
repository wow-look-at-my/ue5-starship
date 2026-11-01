<<<<<<< HEAD
// <ue-details-search-row> wraps a DetailsSearchRow: a real search input, favorites toggle and the view options menu.
import { UeElement, define } from '../_shared/element.ts';
import { wireMenu } from '../_shared/popupmenu.ts';

class UeDetailsSearchRow extends UeElement {
	protected setup(): void {
		const input = this.one<HTMLInputElement>('.DetailsSearchRow-text');
		const clear = this.one<SVGElement>('.DetailsSearchRow-clear');
		if (input && clear) this.wireSearch(input, clear);

		const star = this.one<HTMLButtonElement>('[data-role="favorites"]');
		if (star) {
			this.on(star, 'click', () => {
				const on = star.getAttribute('aria-pressed') !== 'true';
				star.setAttribute('aria-pressed', String(on));
				star.classList.toggle('is-on', on);
				star.title = on ? 'Toggle Favorites (on)' : 'Toggle Favorites';
				this.emit('ue-favorites', { on });
			});
		}

		const gear = this.one<HTMLButtonElement>('[data-role="options"]');
		const menu = this.one('.DetailsSearchRow-menu');
		if (gear && menu) {
			const handle = wireMenu({
				trigger: gear,
				menu,
				itemSelector: '.DetailsSearchRow-menuItem',
				onPick: (item) => {
					if (item.getAttribute('role') === 'menuitemcheckbox') item.setAttribute('aria-checked', String(item.getAttribute('aria-checked') !== 'true'));
					this.emit('ue-view-option', { option: item.dataset.option ?? '', checked: item.getAttribute('aria-checked') === 'true' });
				},
			});
			this.onDispose(handle.dispose);
		}
	}

	private wireSearch(input: HTMLInputElement, clear: SVGElement): void {
		const sync = (): void => {
			const hasText = input.value !== '';
			input.classList.toggle('has-value', hasText);
			clear.classList.toggle('is-hidden', !hasText);
			this.emit('ue-search', { text: input.value });
		};
		const wipe = (): void => {
			input.value = '';
			sync();
			input.focus();
		};
		this.on(input, 'input', sync);
		this.on(input, 'keydown', (event) => {
			if (event.key === 'Escape' && input.value !== '') {
				event.preventDefault();
				wipe();
			}
		});
		this.on(clear, 'click', wipe);
		this.on(clear, 'keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') wipe();
=======
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
>>>>>>> claude/adoring-faraday-94vc0i
		});
	}
}

define('ue-details-search-row', UeDetailsSearchRow);
