// <ue-checkbox> is one .checkbox or .checkbox-toggle control that toggles by mouse and keyboard.
import { UeElement, define } from '../_shared/element.ts';
import './Checkbox.css';

type Tri = 'false' | 'true' | 'mixed';

function disabled(el: HTMLElement): boolean {
	return el.getAttribute('aria-disabled') === 'true';
}

function nextState(el: HTMLElement): Tri {
	const state = el.getAttribute('aria-checked');
	if (el.classList.contains('checkbox--tristate')) {
		if (state === 'false') return 'true';
		return state === 'true' ? 'mixed' : 'false';
	}
	return state === 'true' ? 'false' : 'true';
}

export class UeCheckboxElement extends UeElement {
	protected setup(): void {
		const el = this.one('.checkbox, .checkbox-toggle');
		if (!el) throw new Error('ue-checkbox needs a .checkbox or .checkbox-toggle element');
		const pressedClass = el.classList.contains('checkbox') ? 'checkbox--pressed' : 'checkbox-toggle--pressed';

		this.on(el, 'click', () => {
			if (!disabled(el)) this.#toggle(el);
		});
		this.on(el, 'keydown', (event) => {
			if (disabled(el) || el !== event.target) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			if (!event.repeat) el.classList.add(pressedClass);
		});
		this.on(el, 'keyup', (event) => {
			if (disabled(el) || el !== event.target) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			if (el.classList.contains(pressedClass)) {
				el.classList.remove(pressedClass);
				this.#toggle(el);
			}
		});
		this.on(el, 'focusout', () => el.classList.remove(pressedClass));
	}

	#toggle(el: HTMLElement): void {
		let text: string;
		let checked: boolean | null;
		if (el.classList.contains('checkbox-toggle')) {
			const on = !el.classList.contains('checkbox-toggle--checked');
			el.classList.toggle('checkbox-toggle--checked', on);
			el.setAttribute('aria-pressed', String(on));
			text = on ? 'on' : 'off';
			checked = on;
		} else {
			const state = nextState(el);
			el.setAttribute('aria-checked', state);
			text = state === 'mixed' ? 'undetermined' : state === 'true' ? 'checked' : 'unchecked';
			checked = state === 'mixed' ? null : state === 'true';
		}
		const label = el.dataset.label ?? el.getAttribute('aria-label') ?? el.querySelector('.checkbox__label')?.textContent?.trim() ?? el.textContent?.trim() ?? '';
		this.emit('ue-checkbox-change', { label, state: text, checked, text: label + ' is ' + text });
	}
}

define('ue-checkbox', UeCheckboxElement);
