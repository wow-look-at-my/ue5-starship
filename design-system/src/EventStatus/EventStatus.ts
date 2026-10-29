// <ue-event-status> writes the latest event that bubbles to its parent, so a demo card can show "Picked: Scale" without its own script.
import { UeElement, define } from '../_shared/element.ts';

export class UeEventStatusElement extends UeElement {
	protected setup(): void {
		const host = this.parentElement;
		const type = this.getAttribute('event');
		if (!host || !type) throw new Error('ue-event-status needs a parent element and an event attribute');
		const template = this.getAttribute('template') ?? '{value}';
		this.on(host, type, (event) => {
			const detail = (event as CustomEvent<Record<string, unknown> | null>).detail ?? {};
			this.textContent = template.replace(/\{(\w+)\}/g, (_match, key: string) => String(detail[key] ?? ''));
		});
	}
}

define('ue-event-status', UeEventStatusElement);
