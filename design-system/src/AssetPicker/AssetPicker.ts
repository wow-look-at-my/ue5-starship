<<<<<<< HEAD
// <ue-asset-picker> wraps an AssetPicker row: the combo opens an asset list, the buttons and the reset arrow change the value.
import { UeElement, define } from '../_shared/element.ts';
import { wireMenu } from '../_shared/popupmenu.ts';
=======
// <ue-asset-picker> is an asset property row.
// Its combo, buttons and reset arrow are primitives.
// This element keeps the chosen asset, the thumbnail tooltip and the reset state in step.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ComboButton/ComboButton.ts';
import '../ResetToDefault/ResetToDefault.ts';
import type { UeComboButtonElement } from '../ComboButton/ComboButton.ts';
import './AssetPicker.css';
>>>>>>> claude/adoring-faraday-94vc0i

class UeAssetPicker extends UeElement {
	protected setup(): void {
		const row = this.one('.AssetPicker-row');
<<<<<<< HEAD
		const combo = this.one<HTMLButtonElement>('.AssetPicker-combo');
		const menu = this.one('.AssetPicker-menu');
		const label = this.one('.AssetPicker-combo .label');
		const thumb = this.one('.AssetPicker-thumbFrame');
		const reset = this.one<HTMLButtonElement>('.AssetPicker-reset');
		if (!row || !combo || !menu || !label) return;

		const fallback = row.dataset.default ?? 'None';
		const render = (value: string): void => {
			row.dataset.value = value;
			label.textContent = value;
			for (const item of menu.querySelectorAll<HTMLElement>('.AssetPicker-menuItem')) item.setAttribute('aria-selected', String(item.dataset.asset === value));
=======
		const combo = this.one<UeComboButtonElement>('ue-combo-button');
		const thumb = this.one('.AssetPicker-thumbFrame');
		const reset = this.one('ue-reset-to-default');
		const label = this.one('.combobutton__label');
		if (!row || !combo || !label) return;

		const fallback = row.dataset.default ?? 'None';
		const show = (value: string): void => {
			row.dataset.value = value;
>>>>>>> claude/adoring-faraday-94vc0i
			if (thumb) {
				thumb.title = value === 'None' ? 'None' : '/Game/Props/' + value + '.' + value;
				thumb.setAttribute('aria-label', value);
			}
<<<<<<< HEAD
			if (reset) {
				reset.classList.toggle('is-idle', value === fallback);
				reset.tabIndex = value === fallback ? -1 : 0;
			}
			this.emit('ue-asset-change', { asset: value });
		};
		render(label.textContent ?? fallback);

		const handle = wireMenu({
			trigger: combo,
			menu,
			itemSelector: '.AssetPicker-menuItem',
			onPick: (item) => render(item.dataset.asset ?? fallback),
		});
		this.onDispose(handle.dispose);

		const use = this.one('[data-role="use"]');
		if (use) this.on(use, 'click', () => render(row.dataset.selection ?? fallback));
		const browse = this.one('[data-role="browse"]');
		if (browse) this.on(browse, 'click', () => this.emit('ue-asset-browse', { asset: row.dataset.value ?? fallback }));
		if (reset) this.on(reset, 'click', () => render(fallback));
=======
			reset?.toggleAttribute('differs', value !== fallback);
		};
		const change = (value: string): void => {
			show(value);
			this.emit('ue-asset-change', { asset: value });
		};
		show(label.textContent?.trim() ?? fallback);

		this.on(this, 'ue-combo-pick', (event) => {
			if (this.owns(event.target)) change((event as CustomEvent<{ value: string }>).detail.value);
		});
		this.on(this, 'ue-button-click', (event) => {
			if (!this.owns(event.target)) return;
			const role = (event.target as Element).querySelector('[data-role]')?.getAttribute('data-role');
			if (role === 'use') {
				combo.value = row.dataset.selection ?? fallback;
				change(combo.value);
			} else if (role === 'browse') {
				this.emit('ue-asset-browse', { asset: row.dataset.value ?? fallback });
			}
		});
		this.on(this, 'ue-reset', (event) => {
			if (!this.owns(event.target)) return;
			combo.value = fallback;
			change(fallback);
		});
>>>>>>> claude/adoring-faraday-94vc0i
	}
}

define('ue-asset-picker', UeAssetPicker);
