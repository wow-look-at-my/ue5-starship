<<<<<<< HEAD
// <ue-asset-search-bar> wraps one .AssetSearchBar row.
import { UeElement, define } from '../_shared/element.ts';
import { openMenu, type MenuEntry, type MenuHandle } from '../_shared/contentMenu.ts';

const PREFIX = 'AssetSearchBar';
const CROSS = '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

// Illustrative filter names and their colour tokens.
const FILTERS: Array<{ name: string; color: string }> = [
	{ name: 'Static Mesh', color: 'var(--accent-blue)' },
	{ name: 'Material', color: 'var(--accent-green)' },
	{ name: 'Texture', color: 'var(--accent-orange)' },
	{ name: 'Blueprint', color: 'var(--accent-purple)' },
	{ name: 'Level', color: 'var(--accent-pink)' },
];

class AssetSearchBarElement extends UeElement {
	#row!: HTMLElement;
	#input!: HTMLInputElement;
	#active: string[] = [];
	#menu: MenuHandle | null = null;

	protected setup(): void {
		const row = this.one('.AssetSearchBar');
		const input = this.one<HTMLInputElement>('.AssetSearchBar__input');
		if (!row || !input) throw new Error('ue-asset-search-bar needs a .AssetSearchBar row with a .AssetSearchBar__input');
		this.#row = row;
		this.#input = input;
		this.#active = [];
		this.#menu = null;
		this.#sync();
		this.on(input, 'input', () => {
			this.#sync();
			this.emit('assetsearchbar:change', { text: input.value, filters: this.#active.slice() });
		});
		this.on(input, 'keydown', (event) => {
			if (event.key === 'Escape' && input.value !== '') {
				event.preventDefault();
				this.#clear();
			}
		});
		this.on(row, 'click', (event) => this.#click(event));
		this.on(this, 'click', (event) => this.#pillClick(event));
		this.onDispose(() => this.#menu?.close());
	}

	// Shows the in-field buttons only while the field has text.
	#sync(): void {
		const hasText = this.#input.value !== '';
		for (const button of this.all('.AssetSearchBar__clear, .AssetSearchBar__plus')) button.hidden = !hasText;
	}

	#clear(): void {
		this.#input.value = '';
		this.#sync();
		this.#input.focus();
		this.emit('assetsearchbar:change', { text: '', filters: this.#active.slice() });
	}

	#click(event: MouseEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		if (!target) return;
		if (target.closest('.AssetSearchBar__clear')) {
			this.#clear();
		} else if (target.closest('.AssetSearchBar__plus') || (target.closest('.AssetSearchBar__btn') && !target.closest('.AssetSearchBar__filter'))) {
			this.emit('assetsearchbar:save', { text: this.#input.value });
		} else if (target.closest('.AssetSearchBar__filter')) {
			this.#toggleMenu(target.closest<HTMLElement>('.AssetSearchBar__filter'));
		}
	}

	#toggleMenu(anchor: HTMLElement | null): void {
		if (!anchor) return;
		const previous = this.#menu;
		if (previous) {
			previous.close();
			if (previous.anchor === anchor) return;
		}
		anchor.setAttribute('aria-haspopup', 'menu');
		const entries = FILTERS.map((filter): MenuEntry => ({ label: filter.name, checkable: true, checked: this.#active.includes(filter.name) }));
		this.#menu = openMenu(this.#row, anchor, {
			prefix: PREFIX,
			entries,
			onPick: (index) => this.#toggleFilter(FILTERS[index].name),
			onClose: () => {
				this.#menu = null;
			},
		});
	}

	#toggleFilter(name: string): void {
		this.#active = this.#active.includes(name) ? this.#active.filter((each) => each !== name) : this.#active.concat(name);
		this.#renderPills();
		this.emit('assetsearchbar:change', { text: this.#input.value, filters: this.#active.slice() });
	}

	#pillClick(event: MouseEvent): void {
		const remove = event.target instanceof Element ? event.target.closest<HTMLElement>('.AssetSearchBar__pillRemove') : null;
		const name = remove?.closest<HTMLElement>('.AssetSearchBar__pill')?.getAttribute('aria-label')?.replace(/^Filter: /, '');
		if (name) this.#toggleFilter(name);
	}

	#renderPills(): void {
		let strip = this.one('.AssetSearchBar__pills');
		if (!strip) {
			strip = document.createElement('div');
			strip.className = 'AssetSearchBar__pills';
			strip.setAttribute('role', 'list');
			this.#row.after(strip);
		}
		strip.replaceChildren();
		for (const name of this.#active) {
			const filter = FILTERS.find((each) => each.name === name);
			const pill = document.createElement('span');
			pill.className = 'AssetSearchBar__pill';
			pill.setAttribute('role', 'listitem');
			pill.setAttribute('aria-label', 'Filter: ' + name);
			const colour = document.createElement('span');
			colour.className = 'AssetSearchBar__pillColor';
			colour.style.background = filter?.color ?? 'var(--accent-gray)';
			const label = document.createElement('span');
			label.className = 'AssetSearchBar__pillName';
			label.textContent = name;
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'AssetSearchBar__pillRemove';
			remove.setAttribute('aria-label', 'Remove ' + name + ' filter');
			remove.innerHTML = CROSS;
			pill.append(colour, label, remove);
			strip.append(pill);
		}
=======
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
>>>>>>> claude/adoring-faraday-94vc0i
	}
}

define('ue-asset-search-bar', AssetSearchBarElement);
