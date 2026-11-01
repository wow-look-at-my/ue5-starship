<<<<<<< HEAD
// <ue-asset-picker> is an asset property row.
// Its combo, buttons, reset arrow and the menu behind the combo are primitives.
// This element keeps the chosen asset, the thumbnail tooltip, the reset state and the menu (SPropertyMenuAssetPicker) in step.
import { UeElement, define } from '../_shared/element.ts';
import '../AssetList/AssetList.ts';
import '../Button/Button.ts';
import '../Checkbox/Checkbox.ts';
import '../ComboButton/ComboButton.ts';
import '../ResetToDefault/ResetToDefault.ts';
import '../TextInput/TextInput.ts';
import type { AssetListActivateDetail, AssetListElement } from '../AssetList/AssetList.ts';
import type { UeComboButtonElement } from '../ComboButton/ComboButton.ts';
import './AssetPicker.css';

const NONE = 'None';

// The property clipboard is one per page, as FPropertyEditorClipboard is one per editor.
let clipboard: string | null = null;
=======
// <ue-asset-picker> wraps an AssetPicker row: the combo opens an asset list, the buttons and the reset arrow change the value.
import { UeElement, define } from '../_shared/element.ts';
import { wireMenu } from '../_shared/popupmenu.ts';
>>>>>>> origin/master

class UeAssetPicker extends UeElement {
	protected setup(): void {
		const row = this.one('.AssetPicker-row');
<<<<<<< HEAD
		const combo = this.one<UeComboButtonElement>('ue-combo-button');
		const thumb = this.one('.AssetPicker-thumbFrame');
		const reset = this.one('ue-reset-to-default');
		const label = this.one('.combobutton__label');
		const list = this.one<AssetListElement>('ue-asset-list');
		const field = this.one<HTMLInputElement>('.AssetPicker-browse input');
		if (!row || !combo || !label) return;

		const fallback = row.dataset.default ?? NONE;
		const entry = (value: string): HTMLElement | null => combo.querySelector<HTMLElement>('.popupmenu__row[data-value="' + value + '"]');
		const current = (): string => row.dataset.value ?? fallback;
		const pathOf = (value: string): string => list?.pathOf(value) ?? '/Game/Props/' + value + '.' + value;

		const show = (value: string): void => {
			row.dataset.value = value;
			label.textContent = value;
			if (thumb) {
				thumb.title = value === NONE ? NONE : pathOf(value);
				thumb.setAttribute('aria-label', value);
			}
			reset?.toggleAttribute('differs', value !== fallback);
			list?.select(value === NONE ? null : value);
		};
		const change = (value: string): void => {
			show(value);
			this.emit('ue-asset-change', { asset: value });
		};
		show(label.textContent?.trim() ?? fallback);

		// Each open rebuilds the menu in Slate (SPropertyEditorAsset::OnMenuOpenChanged), so the search starts empty and the current value is selected.
		// Edit shows only for a set value, and Paste only while the clipboard holds an asset (SPropertyMenuAssetPicker.cpp:66-109).
		this.on(this, 'ue-combo-toggle', (event) => {
			if (event.target !== combo || !(event as CustomEvent<{ open: boolean }>).detail.open) return;
			if (field && field.value !== '') {
				field.value = '';
				field.dispatchEvent(new Event('input', { bubbles: true }));
			}
			if (list) list.query = '';
			list?.select(current() === NONE ? null : current());
			const edit = entry('edit');
			if (edit) edit.hidden = current() === NONE;
			entry('paste')?.setAttribute('aria-disabled', String(clipboard === null));
		});

		this.on(this, 'ue-text-input', (event) => {
			if (list && field && (event.target as Element).contains(field)) list.query = (event as CustomEvent<{ value: string }>).detail.value;
		});

		// Up and Down in the search box move through the list.
		if (field && list) {
			this.on(field, 'keydown', (event) => {
				if (event.key === 'ArrowDown' || event.key === 'ArrowUp') list.move(event.key === 'ArrowDown' ? 1 : -1);
				else if (event.key === 'Enter') list.activate();
				else return;
				event.preventDefault();
			});
		}

		this.on(this, 'ue-asset-list-activate', (event) => {
			if (!this.owns(event.target)) return;
			change((event as CustomEvent<AssetListActivateDetail>).detail.id);
			combo.close(true);
		});

		this.on(this, 'ue-combo-pick', (event) => {
			const detail = (event as CustomEvent<{ value: string; checked: boolean | null }>).detail;
			if (event.target !== combo) {
				if (list && this.owns(event.target) && detail.value === 'engine') list.showEngine = detail.checked === true;
				return;
			}
			if (detail.value === 'edit') this.emit('ue-asset-edit', { asset: current() });
			else if (detail.value === 'copy') clipboard = current();
			else if (detail.value === 'paste' && clipboard !== null) change(clipboard);
			else if (detail.value === 'clear') change(NONE);
		});

		this.on(this, 'ue-button-click', (event) => {
			if (!this.owns(event.target)) return;
			const role = (event.target as Element).querySelector('[data-role]')?.getAttribute('data-role');
			if (role === 'use') {
				change(row.dataset.selection ?? fallback);
			} else if (role === 'browse') {
				this.emit('ue-asset-browse', { asset: current() });
			}
		});
		this.on(this, 'ue-reset', (event) => {
			if (!this.owns(event.target)) return;
			change(fallback);
		});
=======
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
			if (thumb) {
				thumb.title = value === 'None' ? 'None' : '/Game/Props/' + value + '.' + value;
				thumb.setAttribute('aria-label', value);
			}
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
>>>>>>> origin/master
	}
}

define('ue-asset-picker', UeAssetPicker);
