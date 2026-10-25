// <ue-notification> lets live toasts be dismissed (the stack closes up) and adds new toasts from its template.
import { UeElement, define } from '../_shared/element.ts';

export class UeNotificationElement extends UeElement {
	#shown = 0;

	protected setup(): void {
		this.on(this, 'click', (event) => {
			if (!(event.target instanceof Element)) return;
			const button = event.target.closest<HTMLElement>('.notification__btn');
			if (!button) return;
			switch (button.dataset.action) {
				case 'dismiss': this.#dismiss(button.closest<HTMLElement>('.notification-slot')); break;
				case 'retry': this.#retry(button); break;
				case 'show': this.#show(); break;
				default: break;
			}
		});
	}

	#dismiss(slot: HTMLElement | null): void {
		if (!slot || slot.classList.contains('notification-slot--closing')) return;
		slot.classList.add('notification-slot--closing');
		void Promise.all(slot.getAnimations().map((animation) => animation.finished.catch(() => undefined))).then(() => {
			slot.remove();
			this.emit('ue-notification-dismiss', {});
		});
	}

	#retry(button: HTMLElement): void {
		const sub = button.closest('.notification')?.querySelector('.notification__sub');
		if (!sub) return;
		const tries = Number(sub.getAttribute('data-tries') ?? '0') + 1;
		sub.setAttribute('data-tries', String(tries));
		sub.textContent = 'Chair.fbx could not be read. Retried ' + tries + (tries === 1 ? ' time.' : ' times.');
	}

	#show(): void {
		const template = this.one<HTMLTemplateElement>('.notification-template');
		const stack = this.one('.notification-stack');
		if (!template || !stack) return;
		const slot = template.content.cloneNode(true);
		this.#shown++;
		if (slot instanceof DocumentFragment) {
			const title = slot.querySelector('.notification__title');
			if (title) title.textContent = 'Saved ' + this.#shown + (this.#shown === 1 ? ' asset' : ' assets');
		}
		stack.prepend(slot);
	}
}

define('ue-notification', UeNotificationElement);
