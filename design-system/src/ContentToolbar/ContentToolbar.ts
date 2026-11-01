// <ue-content-toolbar> wraps one .ContentToolbar row. It owns the path, the
// history and the crumb trail.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ComboButton/ComboButton.ts';
import './ContentToolbar.css';

const CHEVRON = '<svg class="combobutton__icon" viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';

// The folders of the standalone demo. A host replaces this with `childrenOf`.
const CHILDREN: Record<string, string[]> = {
	All: ['Content', 'Plugins'],
	Content: ['StarterContent', 'Developers'],
	StarterContent: ['Architecture', 'Audio', 'Blueprints', 'HDRI', 'Maps', 'Materials', 'Particles', 'Props', 'Shapes', 'Textures'],
};
const FALLBACK_CHILDREN = ['Architecture', 'Audio', 'Blueprints'];

export interface ContentToolbarNavigateDetail {
	path: string[];
}

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function crumbHtml(name: string, index: number, children: string[]): string {
	const rows = children.map((child) => '<div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">' + escape(child) + '</span></span></div>').join('');
	return (
		'<ue-button data-crumb="' + index + '"><button type="button" class="button button--simple button--tight">' + escape(name) + '</button></ue-button>' +
		'<ue-combo-button mode="action" data-crumb-menu="' + index + '"><div class="combobutton-anchor">' +
		'<span class="combobutton combobutton--icon" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" aria-label="Sub-folders of ' + escape(name) + '">' + CHEVRON + '</span>' +
		'<div class="combobutton-menu" hidden><ue-popup-menu><div class="popupmenu" role="menu" tabindex="0">' + rows + '</div></ue-popup-menu></div>' +
		'</div></ue-combo-button>'
	);
}

export class ContentToolbarElement extends UeElement {
	// Names of the folders inside the folder at `path`. The chevron after a crumb lists them.
	childrenOf: (path: string[]) => string[] = (path) => CHILDREN[path[path.length - 1]] ?? FALLBACK_CHILDREN;

	#crumbs!: HTMLElement;
	#path: string[] = [];
	#history: string[][] = [];
	#index = 0;

	get path(): readonly string[] {
		return this.#path;
	}

	protected setup(): void {
		const crumbs = this.one('.ContentToolbar__crumbs');
		if (!crumbs) throw new Error('ue-content-toolbar needs a .ContentToolbar__crumbs element');
		this.#crumbs = crumbs;
		this.#path = this.all('ue-button[data-crumb]').filter((host) => this.owns(host)).map((host) => (host.textContent ?? '').trim());
		this.#history = [this.#path];
		this.#index = 0;
		this.#render();

		this.on(this, 'ue-button-click', (event) => {
			if (!this.owns(event.target)) return;
			const host = (event.target as Element).closest<HTMLElement>('ue-button');
			if (host?.dataset.action === 'back') this.#walk(-1);
			else if (host?.dataset.action === 'forward') this.#walk(1);
			else if (host?.dataset.crumb !== undefined) this.#go(this.#path.slice(0, Number(host.dataset.crumb) + 1));
		});
		this.on(this, 'ue-combo-pick', (event) => {
			if (!this.owns(event.target)) return;
			const host = (event.target as Element).closest<HTMLElement>('ue-combo-button');
			if (host?.dataset.crumbMenu === undefined) return;
			this.#go(this.#path.slice(0, Number(host.dataset.crumbMenu) + 1).concat((event as CustomEvent<{ label: string }>).detail.label));
		});
	}

	// Replaces the history. `index` is the entry that is current. The path follows it. No event fires.
	setHistory(entries: string[][], index: number): void {
		this.#history = entries.map((entry) => entry.slice());
		this.#index = index;
		this.#path = this.#history[index].slice();
		this.#render();
	}

	// Moves to `path` and records it in the history, as a navigation by another part of the page does. No event fires.
	navigate(path: string[]): void {
		this.#record(path);
		this.#render();
	}

	#record(path: string[]): void {
		this.#history = this.#history.slice(0, this.#index + 1);
		this.#history.push(path.slice());
		this.#index = this.#history.length - 1;
		this.#path = path.slice();
	}

	#go(path: string[]): void {
		this.#record(path);
		this.#render();
		this.emit<ContentToolbarNavigateDetail>('contenttoolbar:navigate', { path: path.slice() });
	}

	#walk(delta: number): void {
		const next = this.#index + delta;
		if (next < 0 || next >= this.#history.length) return;
		const hadFocus = this.#navButton(delta < 0 ? 'back' : 'forward') === document.activeElement;
		this.#index = next;
		this.#path = this.#history[next].slice();
		this.#render();
		if (hadFocus) {
			const own = this.#navButton(delta < 0 ? 'back' : 'forward');
			(own && !own.disabled ? own : this.#navButton(delta < 0 ? 'forward' : 'back'))?.focus();
		}
		this.emit<ContentToolbarNavigateDetail>('contenttoolbar:navigate', { path: this.#path.slice() });
	}

	#navButton(action: 'back' | 'forward'): HTMLButtonElement | null {
		return this.one<HTMLButtonElement>('ue-button[data-action="' + action + '"] .button');
	}

	#render(): void {
		this.#crumbs.innerHTML = this.#path.map((name, index) => crumbHtml(name, index, this.childrenOf(this.#path.slice(0, index + 1)))).join('');
		const back = this.#navButton('back');
		const forward = this.#navButton('forward');
		if (back) back.disabled = this.#index === 0;
		if (forward) forward.disabled = this.#index >= this.#history.length - 1;
	}
}

define('ue-content-toolbar', ContentToolbarElement);
