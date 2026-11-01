// <ue-button> is one button: press feedback for the keyboard, the toggle state and a click event.
import { UeElement, define } from '../_shared/element.ts';
import { ownedBy } from '../_shared/own.ts';
import './Button.css';

const PRESSED = 'button--pressed';

function isDisabled(button: HTMLElement): boolean {
	return button.matches(':disabled') || button.getAttribute('aria-disabled') === 'true';
}

export class UeButtonElement extends UeElement {
	#clicks = 0;

	protected setup(): void {
		const button = this.one('.button');
		if (!button) throw new Error('ue-button needs a .button element');

		this.on(button, 'keydown', (event) => {
			if (!ownedBy(this, event.target) || isDisabled(button) || event.repeat) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			button.classList.add(PRESSED);
			if (button.tagName !== 'BUTTON') {
				event.preventDefault();
				if (event.key === 'Enter') button.click();
			}
		});
		this.on(button, 'keyup', (event) => {
			const wasPressed = button.classList.contains(PRESSED);
			button.classList.remove(PRESSED);
			if (wasPressed && button.tagName !== 'BUTTON' && event.key === ' ') button.click();
		});
		this.on(button, 'focusout', () => button.classList.remove(PRESSED));
		this.on(button, 'click', () => {
			if (isDisabled(button)) return;
			let pressed: boolean | null = null;
			if (button.hasAttribute('aria-pressed')) {
				pressed = button.getAttribute('aria-pressed') !== 'true';
				button.setAttribute('aria-pressed', String(pressed));
			}
			this.#clicks++;
			this.emit('ue-button-click', { label: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '', pressed, count: this.#clicks });
		});
	}
}

define('ue-button', UeButtonElement);
