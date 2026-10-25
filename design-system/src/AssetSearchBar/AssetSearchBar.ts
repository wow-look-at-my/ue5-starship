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
	}
}

define('ue-asset-search-bar', AssetSearchBarElement);
