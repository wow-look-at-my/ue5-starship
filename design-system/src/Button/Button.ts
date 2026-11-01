<<<<<<< HEAD
// <ue-button> makes the live buttons inside it respond to the keyboard and count their clicks.
import { UeElement, define } from '../_shared/element.ts';

const PRESSED = 'button--pressed';

function buttonOf(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>('.button') : null;
}

=======
// <ue-button> is one button: press feedback for the keyboard, the toggle state and a click event.
import { UeElement, define } from '../_shared/element.ts';
import { ownedBy } from '../_shared/own.ts';
import './Button.css';

const PRESSED = 'button--pressed';

>>>>>>> claude/adoring-faraday-94vc0i
function isDisabled(button: HTMLElement): boolean {
	return button.matches(':disabled') || button.getAttribute('aria-disabled') === 'true';
}

export class UeButtonElement extends UeElement {
	#clicks = 0;

	protected setup(): void {
<<<<<<< HEAD
		this.on(this, 'keydown', (event) => {
			const button = buttonOf(event.target);
			if (!button || isDisabled(button) || event.repeat) return;
=======
		const button = this.one('.button');
		if (!button) throw new Error('ue-button needs a .button element');

		this.on(button, 'keydown', (event) => {
			if (!ownedBy(this, event.target) || isDisabled(button) || event.repeat) return;
>>>>>>> claude/adoring-faraday-94vc0i
			if (event.key !== 'Enter' && event.key !== ' ') return;
			button.classList.add(PRESSED);
			if (button.tagName !== 'BUTTON') {
				event.preventDefault();
				if (event.key === 'Enter') button.click();
			}
		});
<<<<<<< HEAD
		this.on(this, 'keyup', (event) => {
			const button = buttonOf(event.target);
			if (!button) return;
=======
		this.on(button, 'keyup', (event) => {
>>>>>>> claude/adoring-faraday-94vc0i
			const wasPressed = button.classList.contains(PRESSED);
			button.classList.remove(PRESSED);
			if (wasPressed && button.tagName !== 'BUTTON' && event.key === ' ') button.click();
		});
<<<<<<< HEAD
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
=======
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
>>>>>>> claude/adoring-faraday-94vc0i
		});
	}
}

define('ue-button', UeButtonElement);
