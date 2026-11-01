// Behaviour of a live stack of dock tabs: a tab well over a content area, one panel per tab.
import { UeElement } from './element.ts';

// Class names of one tab component. The names carry no leading dot.
export interface TabStackNames {
	stack: string;
	well: string;
	tab: string;
	close: string;
	reset: string;
	foreground: string;
	active: string;
}

const TARGET_KEYS = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

function targetElement(event: Event): Element | null {
	return event.target instanceof Element ? event.target : null;
}

export abstract class TabStackElement extends UeElement {
	protected abstract readonly names: TabStackNames;
	#snapshot: string | null = null;

	protected setup(): void {
		this.#snapshot ??= this.innerHTML;
		this.on(this, 'pointerdown', (event) => {
			if (event.button !== 0 && event.button !== 2) return;
			const target = targetElement(event);
			const tab = target?.closest<HTMLElement>('.' + this.names.tab);
			if (!tab || !this.contains(tab) || target?.closest('.' + this.names.close)) return;
			this.#activate(tab);
		});
		this.on(this, 'click', (event) => {
			const target = targetElement(event);
			const closeButton = target?.closest('.' + this.names.close);
			if (closeButton) {
				const tab = closeButton.closest<HTMLElement>('.' + this.names.tab);
				if (tab) this.#close(tab);
				return;
			}
			if (target?.closest('.' + this.names.reset)) this.#restore();
		});
		// A middle click closes the tab: SDockTab::OnMouseButtonUp, SDockTab.cpp:106-121.
		this.on(this, 'auxclick', (event) => {
			if (event.button !== 1) return;
			const tab = targetElement(event)?.closest<HTMLElement>('.' + this.names.tab);
			if (!tab) return;
			event.preventDefault();
			this.#close(tab);
		});
		this.on(this, 'keydown', (event) => {
			const tab = targetElement(event)?.closest<HTMLElement>('.' + this.names.tab);
			if (!tab || event.target !== tab) return;
			const stack = tab.closest<HTMLElement>('.' + this.names.stack);
			if (!stack) return;
			const tabs = this.#tabsOf(stack);
			const index = tabs.indexOf(tab);
			if (TARGET_KEYS.includes(event.key)) {
				const target = this.#neighbour(tabs, index, event.key);
				event.preventDefault();
				this.#activate(target);
				target.focus();
			} else if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				this.#activate(tab);
			} else if (event.key === 'Delete') {
				event.preventDefault();
				this.#close(tab);
			}
		});
	}

	#neighbour(tabs: HTMLElement[], index: number, key: string): HTMLElement {
		if (key === 'Home') return tabs[0];
		if (key === 'End') return tabs[tabs.length - 1];
		const step = key === 'ArrowRight' ? 1 : -1;
		return tabs[(index + step + tabs.length) % tabs.length];
	}

	#tabsOf(stack: HTMLElement): HTMLElement[] {
		const well = stack.querySelector('.' + this.names.well);
		return Array.from(well?.children ?? []).filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains(this.names.tab));
	}

	#panelOf(stack: HTMLElement, tab: HTMLElement): HTMLElement | null {
		const panels = Array.from(stack.querySelectorAll<HTMLElement>('[data-panel]'));
		return panels.find((panel) => panel.dataset.panel === tab.dataset.tab) ?? null;
	}

	// Every active tab of every live stack of this component in the page.
	#activeTabs(): HTMLElement[] {
		const selector = this.tagName.toLowerCase() + ' .' + this.names.tab + '.' + this.names.active;
		return Array.from(document.querySelectorAll<HTMLElement>(selector));
	}

	// Makes the tab the foreground tab of its stack and shows its panel.
	#bringToFront(stack: HTMLElement, tab: HTMLElement): void {
		for (const candidate of this.#tabsOf(stack)) {
			const foreground = candidate === tab;
			candidate.classList.toggle(this.names.foreground, foreground);
			candidate.setAttribute('aria-selected', String(foreground));
			candidate.tabIndex = foreground ? 0 : -1;
			const panel = this.#panelOf(stack, candidate);
			if (panel) panel.hidden = !foreground;
		}
	}

	// Foreground plus active. One tab per page is active, like the focused stack of the editor.
	#activate(tab: HTMLElement): void {
		const stack = tab.closest<HTMLElement>('.' + this.names.stack);
		if (!stack) return;
		this.#bringToFront(stack, tab);
		for (const other of this.#activeTabs()) other.classList.remove(this.names.active);
		tab.classList.add(this.names.active);
	}

	// SDockingTabWell::RemoveAndDestroyTab, SDockingTabWell.cpp:617-633: closing the foreground tab selects its left neighbour, or the new first tab.
	#close(tab: HTMLElement): void {
		const stack = tab.closest<HTMLElement>('.' + this.names.stack);
		if (!stack) return;
		const tabs = this.#tabsOf(stack);
		const index = tabs.indexOf(tab);
		const old = tabs.findIndex((candidate) => candidate.classList.contains(this.names.foreground));
		const hadFocus = tab.contains(document.activeElement);
		const wasActive = tab.classList.contains(this.names.active);
		this.#panelOf(stack, tab)?.remove();
		tab.remove();
		const rest = tabs.filter((candidate) => candidate !== tab);
		if (rest.length === 0) return;
		let next: HTMLElement;
		if (old === -1) next = rest[0];
		else if (index <= old) next = rest[Math.max(old - 1, 0)];
		else next = rest[old];
		if (wasActive) this.#activate(next);
		else this.#bringToFront(stack, next);
		if (hadFocus) next.focus();
	}

	// Puts back the markup this element had when it first connected.
	#restore(): void {
		if (this.#snapshot === null) return;
		this.innerHTML = this.#snapshot;
		const tabs = this.all('.' + this.names.tab);
		for (const tab of tabs) tab.classList.remove(this.names.active);
		const foreground = tabs.find((tab) => tab.classList.contains(this.names.foreground));
		if (foreground && this.#activeTabs().length === 0) foreground.classList.add(this.names.active);
	}
}
