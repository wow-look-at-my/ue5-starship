// Base class for the light-DOM custom elements that make the component previews live.

export type Listener<E extends Event> = (event: E) => void;

export abstract class UeElement extends HTMLElement {
	#disposers: Array<() => void> = [];

	#ready = false;
	#pendingSetup: (() => void) | null = null;

	// The bundle can load before the parser reaches this element's children, so setup waits for the document to finish parsing.
	connectedCallback(): void {
		this.style.display = 'contents';
		if (document.readyState !== 'loading') {
			this.#start();
			return;
		}
		this.#pendingSetup = () => this.#start();
		document.addEventListener('DOMContentLoaded', this.#pendingSetup, { once: true });
	}

	disconnectedCallback(): void {
		if (this.#pendingSetup) document.removeEventListener('DOMContentLoaded', this.#pendingSetup);
		this.#pendingSetup = null;
		this.#ready = false;
		for (const dispose of this.#disposers.splice(0)) dispose();
	}

	#start(): void {
		this.#pendingSetup = null;
		if (this.#ready || !this.isConnected) return;
		this.#ready = true;
		this.setup();
	}

	// Wires the existing markup. Runs on every connect, after the run's listeners are removed.
	protected abstract setup(): void;

	// Adds a listener that is removed when the element disconnects.
	protected on<K extends keyof HTMLElementEventMap>(target: EventTarget, type: K, listener: Listener<HTMLElementEventMap[K]>, options?: AddEventListenerOptions): void;
	protected on(target: EventTarget, type: string, listener: Listener<Event>, options?: AddEventListenerOptions): void;
	protected on(target: EventTarget, type: string, listener: Listener<never>, options?: AddEventListenerOptions): void {
		target.addEventListener(type, listener as EventListener, options);
		this.#disposers.push(() => target.removeEventListener(type, listener as EventListener, options));
	}

	// Registers a cleanup that runs when the element disconnects.
	protected onDispose(dispose: () => void): void {
		this.#disposers.push(dispose);
	}

	protected emit<T>(name: string, detail: T): boolean {
		return this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
	}

	protected all<T extends Element = HTMLElement>(selector: string): T[] {
		return Array.from(this.querySelectorAll<T>(selector));
	}

	protected one<T extends Element = HTMLElement>(selector: string): T | null {
		return this.querySelector<T>(selector);
	}
}

// Registers a custom element once, so scripts that import the same module never throw.
export function define(tag: string, ctor: CustomElementConstructor): void {
	if (!customElements.get(tag)) customElements.define(tag, ctor);
}
