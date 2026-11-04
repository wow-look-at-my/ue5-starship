// <ue-tab-well> wraps one live .tabWell-stack: a tab well of <ue-dock-tab>
// tabs over a content area.
import { UeElement, define } from '../_shared/element.ts';
import '../DockTab/DockTab.ts';
import './TabWell.css';

// What ue-tab-activate and ue-tab-close report: the data-tab of the tab and its label text.
export interface TabDetail {
	id: string;
	label: string;
}

const TAB = '.dockTab';
const WELL = '.tabWell-well';
const STACK = '.tabWell-stack';
const TARGET_KEYS = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

function targetElement(event: Event): Element | null {
	return event.target instanceof Element ? event.target : null;
}

class TabWellElement extends UeElement {
	#snapshot: string | null = null;

	protected setup(): void {
		this.#snapshot ??= this.innerHTML;
		this.on(this, 'pointerdown', (event) => {
			if (event.button !== 0 && event.button !== 2) return;
			const target = targetElement(event);
			const tab = target?.closest<HTMLElement>(TAB);
			if (!tab || !this.owns(tab) || target?.closest('.dockTab-close')) return;
			this.#activate(tab);
		});
		this.on(this, 'click', (event) => {
			const target = targetElement(event);
			if (!this.owns(target)) return;
			const closeButton = target?.closest('.dockTab-close');
			if (closeButton) {
				const tab = closeButton.closest<HTMLElement>(TAB);
				if (tab) this.#close(tab);
				return;
			}
			if (target?.closest('.tabWell-reset')) this.#restore();
		});
		// A middle click closes the tab: SDockTab::OnMouseButtonUp, SDockTab.cpp:106-121.
		this.on(this, 'auxclick', (event) => {
			if (event.button !== 1) return;
			const tab = targetElement(event)?.closest<HTMLElement>(TAB);
			if (!tab || !this.owns(tab)) return;
			event.preventDefault();
			this.#close(tab);
		});
		this.on(this, 'keydown', (event) => {
			const tab = targetElement(event)?.closest<HTMLElement>(TAB);
			if (!tab || event.target !== tab || !this.owns(tab)) return;
			const stack = tab.closest<HTMLElement>(STACK);
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

	// The tabs of the well of this stack, each inside its own <ue-dock-tab>.
	#tabsOf(stack: HTMLElement): HTMLElement[] {
		const well = stack.querySelector(WELL);
		return Array.from(well?.querySelectorAll<HTMLElement>(':scope > ue-dock-tab > ' + TAB) ?? []);
	}

	// The panel of this tab. A panel that belongs to a stack nested inside this
	// never matches.
	#panelOf(stack: HTMLElement, tab: HTMLElement): HTMLElement | null {
		const panels = Array.from(stack.querySelectorAll<HTMLElement>('[data-panel]')).filter((panel) => panel.closest(STACK) === stack);
		return panels.find((panel) => panel.dataset.panel === tab.dataset.tab) ?? null;
	}

	#detail(tab: HTMLElement): TabDetail {
		const label = (tab.querySelector('.dockTab-label')?.textContent ?? '').trim();
		return { id: tab.dataset.tab ?? label, label };
	}

	// Every tab of this element in document order, each owned by this element.
	tabs(): HTMLElement[] {
		return this.all(TAB).filter((tab) => this.owns(tab));
	}

	// Makes the tab with this data-tab the foreground tab and the active one.
	activateTab(id: string): void {
		const tab = this.tabs().find((candidate) => this.#detail(candidate).id === id);
		if (tab) this.#activate(tab);
	}

	// Closes the tab with this data-tab.
	closeTab(id: string): void {
		const tab = this.tabs().find((candidate) => this.#detail(candidate).id === id);
		if (tab) this.#close(tab);
	}

	// Every active tab of every live stack of this component in the page. A pinned specimen keeps its forced state.
	#activeTabs(): HTMLElement[] {
		return Array.from(document.querySelectorAll<HTMLElement>(this.localName + ':not([data-pinned], [data-pinned] *) ' + TAB + '.dockTab--active'));
	}

	// Makes the tab the foreground tab of its stack and shows its panel.
	#bringToFront(stack: HTMLElement, tab: HTMLElement): void {
		const changed = !tab.classList.contains('dockTab--foreground');
		for (const candidate of this.#tabsOf(stack)) {
			const foreground = candidate === tab;
			candidate.classList.toggle('dockTab--foreground', foreground);
			candidate.setAttribute('aria-selected', String(foreground));
			candidate.tabIndex = foreground ? 0 : -1;
			const panel = this.#panelOf(stack, candidate);
			if (panel) panel.hidden = !foreground;
		}
		if (changed) this.emit<TabDetail>('ue-tab-activate', this.#detail(tab));
	}

	// Foreground plus active. One tab per page is active, like the focused stack of the editor.
	#activate(tab: HTMLElement): void {
		const stack = tab.closest<HTMLElement>(STACK);
		if (!stack) return;
		this.#bringToFront(stack, tab);
		for (const other of this.#activeTabs()) other.classList.remove('dockTab--active');
		tab.classList.add('dockTab--active');
	}

	// SDockingTabWell::RemoveAndDestroyTab, SDockingTabWell.cpp:617-633: closing the foreground tab selects its left neighbour, or the new first tab.
	#close(tab: HTMLElement): void {
		const stack = tab.closest<HTMLElement>(STACK);
		if (!stack) return;
		const tabs = this.#tabsOf(stack);
		const index = tabs.indexOf(tab);
		const old = tabs.findIndex((candidate) => candidate.classList.contains('dockTab--foreground'));
		const hadFocus = tab.contains(document.activeElement);
		const wasActive = tab.classList.contains('dockTab--active');
		const closed = this.#detail(tab);
		this.#panelOf(stack, tab)?.remove();
		(tab.closest('ue-dock-tab') ?? tab).remove();
		this.emit<TabDetail>('ue-tab-close', closed);
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
		const tabs = this.all(TAB);
		for (const tab of tabs) tab.classList.remove('dockTab--active');
		const foreground = tabs.find((tab) => tab.classList.contains('dockTab--foreground'));
		if (foreground && this.#activeTabs().length === 0) foreground.classList.add('dockTab--active');
	}
}

define('ue-tab-well', TabWellElement);
