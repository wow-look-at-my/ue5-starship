// <ue-text-input> wraps live .textinput boxes. The browser edits the <input>. The element adds the search clear button.
import { UeElement, define } from '../_shared/element.ts';

function fieldOf(target: EventTarget | null): HTMLInputElement | null {
	return target instanceof HTMLInputElement && target.classList.contains('textinput__field') ? target : null;
}

export class UeTextInputElement extends UeElement {
	protected setup(): void {
		for (const field of this.all<HTMLInputElement>('.textinput__field')) this.#sync(field);

		this.on(this, 'input', (event) => {
			const field = fieldOf(event.target);
			if (field) this.#sync(field);
		});

		this.on(this, 'click', (event) => {
			if (!(event.target instanceof Element)) return;
			const clear = event.target.closest('.textinput__clear');
			const box = event.target.closest<HTMLElement>('.textinput');
			const field = box?.querySelector<HTMLInputElement>('.textinput__field') ?? null;
			if (!box || !field) return;
			if (clear) this.#clear(field);
			else if (event.target !== field) field.focus();
		});

		this.on(this, 'keydown', (event) => {
			const field = fieldOf(event.target);
			if (!field || event.key !== 'Escape' || field.readOnly || field.value === '') return;
			if (!field.closest('.textinput--search')) return;
			event.preventDefault();
			this.#clear(field);
		});
	}

	#sync(field: HTMLInputElement): void {
		field.closest('.textinput--search')?.classList.toggle('textinput--filled', field.value !== '');
	}

	#clear(field: HTMLInputElement): void {
		field.value = '';
		this.#sync(field);
		field.focus();
		this.emit('ue-text-clear', {});
	}
}

define('ue-text-input', UeTextInputElement);
