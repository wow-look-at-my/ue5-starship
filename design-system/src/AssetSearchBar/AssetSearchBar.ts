// <ue-asset-search-bar> wraps one .AssetSearchBar row. The field is ue-text-input. The buttons are ue-button. The filter menu is ue-combo-button and the filters are ue-filter-pills chips.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ComboButton/ComboButton.ts';
import type { UeFilterPills } from '../FilterPills/FilterPills.ts';
import '../FilterPills/FilterPills.ts';
import '../TextInput/TextInput.ts';
import './AssetSearchBar.css';

// Filter names and the colour of their chip segment.
const FILTERS: Record<string, string> = {
	'Static Mesh': 'var(--accent-blue)',
	Material: 'var(--accent-green)',
	Texture: 'var(--accent-orange)',
	Blueprint: 'var(--accent-purple)',
	Level: 'var(--accent-pink)',
};

export interface AssetSearchBarChangeDetail {
	text: string;
	filters: string[];
}

export class AssetSearchBarElement extends UeElement {
	#input!: HTMLInputElement;
	#chips!: UeFilterPills;

	protected setup(): void {
		const input = this.one<HTMLInputElement>('.textinput__field');
		const chips = this.one<UeFilterPills>('ue-filter-pills');
		if (!input || !chips) throw new Error('ue-asset-search-bar needs a .textinput__field input and a ue-filter-pills');
		this.#input = input;
		this.#chips = chips;
		this.#syncPlus();

		this.on(this, 'ue-text-input', (event) => {
			if (!this.#mine(event)) return;
			this.#syncPlus();
			this.#announce();
		});
		this.on(this, 'ue-button-click', (event) => {
			if (this.#mine(event) && (event.target as HTMLElement).dataset.action === 'save') this.emit('assetsearchbar:save', { text: this.#input.value });
		});
		this.on(this, 'ue-combo-pick', (event) => {
			if (!this.#mine(event)) return;
			const { label, checked } = (event as CustomEvent<{ label: string; checked: boolean | null }>).detail;
			if (checked) this.#chips.addChip({ id: label, label, color: FILTERS[label] });
			else this.#chips.removeChip(label);
		});
		this.on(this, 'ue-pill-add', (event) => {
			if (this.#mine(event)) this.#announce();
		});
		this.on(this, 'ue-pill-remove', (event) => {
			if (!this.#mine(event)) return;
			this.#uncheck((event as CustomEvent<{ id: string }>).detail.id);
			this.#announce();
		});
	}

	get text(): string {
		return this.#input.value;
	}

	// Sets the hint of the field.
	setPlaceholder(text: string): void {
		this.#input.placeholder = text;
	}

	// Sets the text of the field as typing would, so the clear X and the change event follow.
	setText(text: string): void {
		if (this.#input.value === text) return;
		this.#input.value = text;
		this.#input.dispatchEvent(new Event('input', { bubbles: true }));
	}

	#mine(event: Event): boolean {
		return this.owns(event.target);
	}

	// The save-search plus shows only while the field has text.
	#syncPlus(): void {
		for (const plus of this.all('.AssetSearchBar__plus')) plus.hidden = this.#input.value === '';
	}

	// A chip that went away leaves its menu row unchecked.
	#uncheck(id: string): void {
		for (const row of this.all('.popupmenu__row[role="menuitemcheckbox"]')) if (row.dataset.value === id) row.setAttribute('aria-checked', 'false');
	}

	#announce(): void {
		this.emit<AssetSearchBarChangeDetail>('assetsearchbar:change', { text: this.#input.value, filters: this.#chips.getChips().map((chip) => chip.id) });
	}
}

define('ue-asset-search-bar', AssetSearchBarElement);
