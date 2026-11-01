<<<<<<< HEAD
// <ue-expandable-area> toggles the body of each .expandablearea inside it from its header.
import { UeElement, define } from '../_shared/element.ts';

function headerOf(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>('.expandablearea__header[role="button"]') : null;
=======
// <ue-expandable-area> toggles the body of its one .expandablearea from the header.
import { UeElement, define } from '../_shared/element.ts';
import { ownedBy } from '../_shared/own.ts';
import './ExpandableArea.css';

// A control inside the header keeps its own click. It must not fold the area.
const INTERACTIVE = 'button, a[href], input, select, textarea, label, [tabindex], [role="button"], [role="checkbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="menuitem"]';

function isNestedControl(target: Element, header: HTMLElement): boolean {
	for (let node: Element | null = target; node && node !== header; node = node.parentElement) {
		if (node.localName.startsWith('ue-') || node.matches(INTERACTIVE)) return true;
	}
	return false;
>>>>>>> claude/adoring-faraday-94vc0i
}

export class UeExpandableAreaElement extends UeElement {
	protected setup(): void {
<<<<<<< HEAD
		for (const header of this.all('.expandablearea__header[role="button"]')) this.#apply(header, header.getAttribute('aria-expanded') === 'true');

		this.on(this, 'click', (event) => {
			const header = headerOf(event.target);
			if (header) this.#apply(header, header.getAttribute('aria-expanded') !== 'true');
		});
		this.on(this, 'keydown', (event) => {
			const header = headerOf(event.target);
			if (!header || header !== event.target || (event.key !== 'Enter' && event.key !== ' ')) return;
			event.preventDefault();
			if (!event.repeat) this.#apply(header, header.getAttribute('aria-expanded') !== 'true');
		});
	}

	#apply(header: HTMLElement, expanded: boolean): void {
		header.setAttribute('aria-expanded', String(expanded));
		const body = header.parentElement?.querySelector<HTMLElement>(':scope > .expandablearea__body');
		if (body) body.hidden = !expanded;
		this.emit('ue-area-toggle', { expanded });
=======
		const header = this.one('.expandablearea__header[role="button"]');
		if (!header) throw new Error('ue-expandable-area needs a .expandablearea__header[role="button"]');
		this.#apply(header, header.getAttribute('aria-expanded') === 'true', false);

		this.on(header, 'click', (event) => {
			if (ownedBy(this, event.target) && !isNestedControl(event.target, header)) this.#apply(header, header.getAttribute('aria-expanded') !== 'true', true);
		});
		this.on(header, 'keydown', (event) => {
			if (header !== event.target || (event.key !== 'Enter' && event.key !== ' ')) return;
			event.preventDefault();
			if (!event.repeat) this.#apply(header, header.getAttribute('aria-expanded') !== 'true', true);
		});
	}

	#apply(header: HTMLElement, expanded: boolean, announce: boolean): void {
		header.setAttribute('aria-expanded', String(expanded));
		const body = header.parentElement?.querySelector<HTMLElement>(':scope > .expandablearea__body');
		if (body) body.hidden = !expanded;
		if (announce) this.emit('ue-expand-toggle', { expanded });
>>>>>>> claude/adoring-faraday-94vc0i
	}
}

define('ue-expandable-area', UeExpandableAreaElement);
