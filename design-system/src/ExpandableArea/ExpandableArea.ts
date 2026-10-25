// <ue-expandable-area> toggles the body of each .expandablearea inside it from its header.
import { UeElement, define } from '../_shared/element.ts';

function headerOf(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>('.expandablearea__header[role="button"]') : null;
}

export class UeExpandableAreaElement extends UeElement {
	protected setup(): void {
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
	}
}

define('ue-expandable-area', UeExpandableAreaElement);
