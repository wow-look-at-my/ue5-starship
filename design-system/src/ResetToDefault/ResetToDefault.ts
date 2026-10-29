// <ue-reset-to-default> is the reset arrow to the right of a property value. The differs attribute shows it.
import { UeElement, define } from '../_shared/element.ts';
import './ResetToDefault.css';

export class UeResetToDefaultElement extends UeElement {
	static observedAttributes = ['differs'];

	attributeChangedCallback(): void {
		this.#sync();
	}

	protected setup(): void {
		const button = this.one<HTMLButtonElement>('button.resettodefault');
		if (!button) throw new Error('ue-reset-to-default needs a button.resettodefault element');
		this.#sync();
		this.on(button, 'click', () => {
			if (this.hasAttribute('differs')) this.emit('ue-reset', {});
		});
	}

	// The idle button keeps its slot but is invisible, disabled and out of the tab order.
	#sync(): void {
		const button = this.one<HTMLButtonElement>('button.resettodefault');
		if (!button) return;
		const differs = this.hasAttribute('differs');
		button.classList.toggle('resettodefault--idle', !differs);
		button.disabled = !differs;
	}
}

define('ue-reset-to-default', UeResetToDefaultElement);
