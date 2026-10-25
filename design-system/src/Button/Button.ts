// <ue-button> makes the live buttons inside it respond to the keyboard and count their clicks.
import { UeElement, define } from '../_shared/element.ts';

const PRESSED = 'button--pressed';

function buttonOf(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>('.button') : null;
}

function isDisabled(button: HTMLElement): boolean {
	return button.matches(':disabled') || button.getAttribute('aria-disabled') === 'true';
}

export class UeButtonElement extends UeElement {
	#clicks = 0;

	protected setup(): void {
		this.on(this, 'keydown', (event) => {
			const button = buttonOf(event.target);
			if (!button || isDisabled(button) || event.repeat) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			button.classList.add(PRESSED);
			if (button.tagName !== 'BUTTON') {
				event.preventDefault();
				if (event.key === 'Enter') button.click();
			}
		});
		this.on(this, 'keyup', (event) => {
			const button = buttonOf(event.target);
			if (!button) return;
			const wasPressed = button.classList.contains(PRESSED);
			button.classList.remove(PRESSED);
			if (wasPressed && button.tagName !== 'BUTTON' && event.key === ' ') button.click();
		});
		this.on(this, 'focusout', (event) => {
			const button = buttonOf(event.target);
			if (button) button.classList.remove(PRESSED);
		});
		this.on(this, 'click', (event) => {
			const button = buttonOf(event.target);
			if (!button || isDisabled(button)) return;
			this.#clicks++;
			this.dataset.clicks = String(this.#clicks);
			const counter = this.one('.button-count');
			if (counter) counter.textContent = 'Clicks: ' + this.#clicks + ' (last: ' + (button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '') + ')';
		});
	}
}

define('ue-button', UeButtonElement);
