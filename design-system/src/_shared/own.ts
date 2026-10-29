// Ownership test for primitive elements that can nest, such as a combo button inside a row that sits inside another primitive.

// True when `target` is inside `host` and no other element of the same tag sits between them.
export function ownedBy(host: HTMLElement, target: EventTarget | null): target is Element {
	return target instanceof Element && target.closest(host.localName) === host;
}
