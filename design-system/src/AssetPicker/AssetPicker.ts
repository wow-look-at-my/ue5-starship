// <ue-asset-picker> wraps an AssetPicker row: the combo opens an asset list, the buttons and the reset arrow change the value.
import { UeElement, define } from '../_shared/element.ts';
import { wireMenu } from '../_shared/popupmenu.ts';

class UeAssetPicker extends UeElement {
	protected setup(): void {
		const row = this.one('.AssetPicker-row');
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
	}
}

define('ue-asset-picker', UeAssetPicker);
