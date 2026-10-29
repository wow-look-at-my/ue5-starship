// <ue-asset-picker> is an asset property row.
// Its combo, buttons and reset arrow are primitives.
// This element keeps the chosen asset, the thumbnail tooltip and the reset state in step.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ComboButton/ComboButton.ts';
import '../ResetToDefault/ResetToDefault.ts';
import type { UeComboButtonElement } from '../ComboButton/ComboButton.ts';
import './AssetPicker.css';

class UeAssetPicker extends UeElement {
	protected setup(): void {
		const row = this.one('.AssetPicker-row');
		const combo = this.one<UeComboButtonElement>('ue-combo-button');
		const thumb = this.one('.AssetPicker-thumbFrame');
		const reset = this.one('ue-reset-to-default');
		const label = this.one('.combobutton__label');
		if (!row || !combo || !label) return;

		const fallback = row.dataset.default ?? 'None';
		const show = (value: string): void => {
			row.dataset.value = value;
			if (thumb) {
				thumb.title = value === 'None' ? 'None' : '/Game/Props/' + value + '.' + value;
				thumb.setAttribute('aria-label', value);
			}
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
	}
}

define('ue-asset-picker', UeAssetPicker);
