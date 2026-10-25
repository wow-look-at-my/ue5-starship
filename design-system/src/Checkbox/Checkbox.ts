// <ue-checkbox> makes the live .checkbox and .checkbox-toggle controls inside it toggle by mouse and keyboard.
import { UeElement, define } from '../_shared/element.ts';

type Tri = 'false' | 'true' | 'mixed';

function control(target: EventTarget | null): HTMLElement | null {
	return target instanceof Element ? target.closest<HTMLElement>('.checkbox, .checkbox-toggle') : null;
}

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
	}

	#toggle(el: HTMLElement): void {
		let text: string;
		if (el.classList.contains('checkbox-toggle')) {
			const on = !el.classList.contains('checkbox-toggle--checked');
			el.classList.toggle('checkbox-toggle--checked', on);
			el.setAttribute('aria-pressed', String(on));
			text = on ? 'on' : 'off';
		} else {
			const state = nextState(el);
			el.setAttribute('aria-checked', state);
			text = state === 'mixed' ? 'undetermined' : state === 'true' ? 'checked' : 'unchecked';
		}
		const status = this.one('.checkbox-status');
		if (status) status.textContent = 'Last change: ' + (el.dataset.label ?? '') + ' is ' + text;
		this.emit('ue-checkbox-change', { label: el.dataset.label ?? '', state: text });
	}
}

define('ue-checkbox', UeCheckboxElement);
