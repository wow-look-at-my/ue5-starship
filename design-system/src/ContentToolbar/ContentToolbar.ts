// <ue-content-toolbar> wraps one .ContentToolbar row: pressed states, a history that Back and Forward walk, clickable crumbs and menus.
import { UeElement, define } from '../_shared/element.ts';
import { openMenu, type MenuEntry, type MenuHandle } from '../_shared/contentMenu.ts';

const CHEVRON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
const PREFIX = 'ContentToolbar';

const CHILDREN: Record<string, string[]> = {
	All: ['Content', 'Plugins'],
	Content: ['StarterContent', 'Developers'],
	StarterContent: ['Architecture', 'Audio', 'Blueprints', 'HDRI', 'Maps', 'Materials', 'Particles', 'Props', 'Shapes', 'Textures'],
};
const FALLBACK_CHILDREN = ['Architecture', 'Audio', 'Blueprints'];

const ADD_ENTRIES: MenuEntry[] = [
	{ label: 'Import to Current Folder' },
	{ separator: true },
	{ label: 'New Folder' },
	{ label: 'Blueprint Class' },
	{ label: 'Level' },
	{ label: 'Material' },
];

const SETTINGS_DEFAULTS: Array<[string, boolean]> = [
	['Show Folders', true],
	['Show Empty Folders', false],
	['Show Favorites', false],
	['Show Developers Content', false],
	['Show Engine Content', false],
	['Show Plugin Content', true],
];

class ContentToolbarElement extends UeElement {
	#root!: HTMLElement;
	#history: string[][] = [];
	#index = 0;
	#menu: MenuHandle | null = null;
	#checks = new Map<string, boolean>();

	protected setup(): void {
		const root = this.one('.ContentToolbar');
		if (!root) throw new Error('ue-content-toolbar needs a .ContentToolbar child');
		this.#root = root;
		this.#history = [this.#trail()];
		this.#index = 0;
		this.#menu = null;
		this.#checks = new Map(SETTINGS_DEFAULTS);
		this.#syncNav();
		this.on(root, 'click', (event) => this.#click(event));
		this.onDispose(() => this.#menu?.close());
	}

	#trail(): string[] {
		return this.all('.ContentToolbar__crumb').map((crumb) => (crumb.textContent ?? '').trim());
	}

	#nav(which: 'back' | 'fwd'): HTMLButtonElement | null {
		return this.one<HTMLButtonElement>('.ContentToolbar__nav--' + which);
	}

	#click(event: MouseEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		const button = target?.closest<HTMLButtonElement>('button');
		if (!button || !this.#root.contains(button) || button.disabled) return;
		const list = button.classList;
		if (list.contains('ContentToolbar__crumb')) {
			const at = this.all('.ContentToolbar__crumb').indexOf(button);
			this.#navigate(this.#trail().slice(0, at + 1), at);
		} else if (list.contains('ContentToolbar__delim')) {
			this.#openChildren(button);
		} else if (list.contains('ContentToolbar__nav--back')) {
			this.#walk(-1);
		} else if (list.contains('ContentToolbar__nav--fwd')) {
			this.#walk(1);
		} else if (list.contains('ContentToolbar__add')) {
			this.#toggleMenu(button, ADD_ENTRIES, () => undefined);
		} else if (list.contains('ContentToolbar__settings')) {
			const entries = Array.from(this.#checks, ([label, checked]): MenuEntry => ({ label, checkable: true, checked }));
			this.#toggleMenu(button, entries, (index) => {
				const label = entries[index].label ?? '';
				this.#checks.set(label, !this.#checks.get(label));
			});
		} else if (list.contains('ContentToolbar__btn')) {
			this.emit('contenttoolbar:action', { label: (button.textContent ?? '').trim() });
		}
	}

	#openChildren(delim: HTMLElement): void {
		const delims = this.all('.ContentToolbar__delim');
		const at = delims.indexOf(delim);
		const trail = this.#trail().slice(0, at + 1);
		const names = CHILDREN[trail[at]] ?? FALLBACK_CHILDREN;
		this.#toggleMenu(
			delim,
			names.map((label): MenuEntry => ({ label })),
			(index) => this.#navigate(trail.concat(names[index]), trail.length),
		);
	}

	#toggleMenu(anchor: HTMLElement, entries: MenuEntry[], onPick: (index: number) => void): void {
		const previous = this.#menu;
		if (previous) {
			previous.close();
			if (previous.anchor === anchor) return;
		}
		anchor.setAttribute('aria-haspopup', 'menu');
		this.#menu = openMenu(this.#root, anchor, {
			prefix: PREFIX,
			entries,
			onPick,
			onClose: () => {
				this.#menu = null;
			},
		});
	}

	#navigate(trail: string[], focusAt: number): void {
		const current = this.#history[this.#index];
		if (trail.join('/') === current.join('/')) return;
		this.#history = this.#history.slice(0, this.#index + 1);
		this.#history.push(trail);
		this.#index = this.#history.length - 1;
		this.#renderTrail(focusAt);
		this.#syncNav();
		this.emit('contenttoolbar:navigate', { path: trail });
	}

	#walk(delta: number): void {
		const next = this.#index + delta;
		if (next < 0 || next >= this.#history.length) return;
		const hadFocus = this.#root.contains(document.activeElement) && document.activeElement instanceof HTMLButtonElement && document.activeElement.classList.contains('ContentToolbar__nav');
		this.#index = next;
		this.#renderTrail(-1);
		this.#syncNav();
		if (hadFocus) {
			const own = this.#nav(delta < 0 ? 'back' : 'fwd');
			const other = this.#nav(delta < 0 ? 'fwd' : 'back');
			(own && !own.disabled ? own : other)?.focus();
		}
		this.emit('contenttoolbar:navigate', { path: this.#history[this.#index] });
	}

	#syncNav(): void {
		const back = this.#nav('back');
		const fwd = this.#nav('fwd');
		if (back) back.disabled = this.#index === 0;
		if (fwd) fwd.disabled = this.#index >= this.#history.length - 1;
	}

	// Rebuilds the crumbs and delimiters from the history entry.
	#renderTrail(focusAt: number): void {
		const path = this.one('.ContentToolbar__path');
		if (!path) throw new Error('ue-content-toolbar needs a .ContentToolbar__path');
		const hadFocus = focusAt >= 0 && path.contains(document.activeElement);
		for (const old of this.all('.ContentToolbar__crumb, .ContentToolbar__delim')) old.remove();
		for (const name of this.#history[this.#index]) {
			const crumb = document.createElement('button');
			crumb.type = 'button';
			crumb.className = 'ContentToolbar__crumb';
			crumb.textContent = name;
			const delim = document.createElement('button');
			delim.type = 'button';
			delim.className = 'ContentToolbar__delim';
			delim.setAttribute('aria-label', 'Sub-folders of ' + name);
			delim.innerHTML = CHEVRON;
			path.append(crumb, delim);
		}
		if (hadFocus) this.all('.ContentToolbar__crumb')[focusAt]?.focus();
	}
}

define('ue-content-toolbar', ContentToolbarElement);
