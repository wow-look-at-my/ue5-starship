// <ue-text-input> is one .textinput box. The browser edits the <input>. The element adds the search clear button and the events.
import { UeElement, define } from '../_shared/element.ts';
import './TextInput.css';

export class UeTextInputElement extends UeElement {
	protected setup(): void {
		const box = this.one('.textinput');
		const field = box?.querySelector<HTMLInputElement>('.textinput__field');
		if (!box || !field) throw new Error('ue-text-input needs a .textinput box with a .textinput__field input');
		const search = box.classList.contains('textinput--search');
		const sync = (): void => {
			if (search) box.classList.toggle('textinput--filled', field.value !== '');
		};
		const clear = (): void => {
			field.value = '';
			sync();
			field.focus();
			this.emit('ue-text-input', { value: '' });
			this.emit('ue-text-clear', {});
		};
		sync();

		this.on(field, 'input', () => {
			sync();
			this.emit('ue-text-input', { value: field.value });
		});

		this.on(box, 'click', (event) => {
			if (!(event.target instanceof Element)) return;
			if (event.target.closest('.textinput__clear')) clear();
			else if (event.target !== field && !event.target.closest('.textinput__trail')) field.focus();
		});

		this.on(field, 'keydown', (event) => {
			if (!search || event.key !== 'Escape' || field.readOnly || field.value === '') return;
			event.preventDefault();
			clear();
		});
	}
}

define('ue-text-input', UeTextInputElement);
