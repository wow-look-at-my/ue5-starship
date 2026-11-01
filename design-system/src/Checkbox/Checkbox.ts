<<<<<<< HEAD
// <ue-checkbox> makes the live .checkbox and .checkbox-toggle controls inside it toggle by mouse and keyboard.
import { UeElement, define } from '../_shared/element.ts';

type Tri = 'false' | 'true' | 'mixed';

function control(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>('.checkbox, .checkbox-toggle') : null;
}

=======
// <ue-checkbox> is one .checkbox or .checkbox-toggle control that toggles by mouse and keyboard.
import { UeElement, define } from '../_shared/element.ts';
import './Checkbox.css';

type Tri = 'false' | 'true' | 'mixed';

>>>>>>> claude/adoring-faraday-94vc0i
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
<<<<<<< HEAD
		this.on(this, 'click', (event) => {
			const el = control(event.target);
			if (el && !disabled(el)) this.#toggle(el);
		});
		this.on(this, 'keydown', (event) => {
			const el = control(event.target);
			if (!el || disabled(el) || el !== event.target) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			if (!event.repeat) el.classList.add(el.classList.contains('checkbox') ? 'checkbox--pressed' : 'checkbox-toggle--pressed');
		});
		this.on(this, 'keyup', (event) => {
			const el = control(event.target);
			if (!el || disabled(el) || el !== event.target) return;
			if (event.key !== 'Enter' && event.key !== ' ') return;
			const cls = el.classList.contains('checkbox') ? 'checkbox--pressed' : 'checkbox-toggle--pressed';
			if (el.classList.contains(cls)) {
				el.classList.remove(cls);
				this.#toggle(el);
			}
		});
		this.on(this, 'focusout', (event) => {
			const el = control(event.target);
			if (el) el.classList.remove('checkbox--pressed', 'checkbox-toggle--pressed');
		});
=======
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
>>>>>>> claude/adoring-faraday-94vc0i
	}

	#toggle(el: HTMLElement): void {
		let text: string;
<<<<<<< HEAD
=======
		let checked: boolean | null;
>>>>>>> claude/adoring-faraday-94vc0i
		if (el.classList.contains('checkbox-toggle')) {
			const on = !el.classList.contains('checkbox-toggle--checked');
			el.classList.toggle('checkbox-toggle--checked', on);
			el.setAttribute('aria-pressed', String(on));
			text = on ? 'on' : 'off';
<<<<<<< HEAD
=======
			checked = on;
>>>>>>> claude/adoring-faraday-94vc0i
		} else {
			const state = nextState(el);
			el.setAttribute('aria-checked', state);
			text = state === 'mixed' ? 'undetermined' : state === 'true' ? 'checked' : 'unchecked';
<<<<<<< HEAD
		}
		const status = this.one('.checkbox-status');
		if (status) status.textContent = 'Last change: ' + (el.dataset.label ?? '') + ' is ' + text;
		this.emit('ue-checkbox-change', { label: el.dataset.label ?? '', state: text });
=======
			checked = state === 'mixed' ? null : state === 'true';
		}
		const label = el.dataset.label ?? el.getAttribute('aria-label') ?? el.querySelector('.checkbox__label')?.textContent?.trim() ?? el.textContent?.trim() ?? '';
		this.emit('ue-checkbox-change', { label, state: text, checked, text: label + ' is ' + text });
>>>>>>> claude/adoring-faraday-94vc0i
	}
}

define('ue-checkbox', UeCheckboxElement);
