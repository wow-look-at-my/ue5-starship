// <ue-vector-input> is a set of Details transform rows. The primitives own the drag, the typing, the menu and the arrow. This element owns the
// lock that links the axes and the reset state.
import { UeElement, define } from '../_shared/element.ts';
import '../Button/Button.ts';
import '../ComboButton/ComboButton.ts';
import '../ResetToDefault/ResetToDefault.ts';
import '../SpinBox/SpinBox.ts';
import type { UeSpinBoxElement } from '../SpinBox/SpinBox.ts';
import './VectorInput.css';

const round = (value: number): number => Math.round(value * 1e6) / 1e6;

class UeVectorInput extends UeElement {
	// The values of each row as of the last change, which is the basis of the lock ratio.
	#last = new WeakMap<HTMLElement, number[]>();

	protected setup(): void {
		for (const row of this.all('.VectorInput-row')) {
			if (!this.owns(row)) continue;
			this.#last.set(row, this.#read(row));
			this.#syncReset(row, this.#read(row));
		}

		this.on(this, 'ue-spin-change', (event) => {
			const row = this.#rowOf(event.target);
			if (!row) return;
			const fields = this.#fields(row);
			const index = fields.indexOf(event.target as UeSpinBoxElement);
			const values = this.#read(row);
			const before = this.#last.get(row) ?? values;
			if (this.#locked(row)) {
				for (let j = 0; j < fields.length; j++) {
					if (j === index) continue;
					values[j] = before[index] === 0 ? values[index] : round((before[j] * values[index]) / before[index]);
					fields[j].value = values[j];
				}
			}
			this.#commit(row, values);
		});

		this.on(this, 'ue-reset', (event) => {
			const row = this.#rowOf(event.target);
			if (!row) return;
			const defaults = (row.dataset.default ?? '').split(',').map(Number);
			this.#fields(row).forEach((field, i) => {
				field.value = defaults[i];
			});
			this.#commit(row, defaults);
		});

		this.on(this, 'ue-button-click', (event) => {
			const lock = this.#rowOf(event.target) ? (event.target as Element).querySelector<HTMLElement>('[data-role="lock"]') : null;
			if (lock) lock.title = (event as CustomEvent<{ pressed: boolean | null }>).detail.pressed ? 'Scale uniformly (locked)' : 'Scale uniformly (unlocked)';
		});

		this.on(this, 'ue-combo-pick', (event) => {
			if (this.#rowOf(event.target)) this.emit('ue-vector-space', { space: (event as CustomEvent<{ label: string }>).detail.label });
		});
	}

	// The row of this element that holds the target, or null for a target of a nested instance.
	#rowOf(target: EventTarget | null): HTMLElement | null {
		if (!this.owns(target)) return null;
		return (target as Element).closest<HTMLElement>('.VectorInput-row');
	}

	#fields(row: HTMLElement): UeSpinBoxElement[] {
		return Array.from(row.querySelectorAll<UeSpinBoxElement>('ue-spin-box'));
	}

	#read(row: HTMLElement): number[] {
		return Array.from(row.querySelectorAll<HTMLElement>('.spinbox'), (box) => Number(box.dataset.value));
	}

	#locked(row: HTMLElement): boolean {
		return row.querySelector('[data-role="lock"]')?.getAttribute('aria-pressed') === 'true';
	}

	// Shows the reset arrow only while a value differs from its default.
	#syncReset(row: HTMLElement, values: number[]): void {
		const defaults = (row.dataset.default ?? '').split(',').map(Number);
		row.querySelector('ue-reset-to-default')?.toggleAttribute('differs', values.some((value, i) => Math.abs(value - defaults[i]) > 1e-9));
	}

	#commit(row: HTMLElement, values: number[]): void {
		this.#last.set(row, values);
		this.#syncReset(row, values);
		this.emit('ue-vector-change', { values });
	}
}

define('ue-vector-input', UeVectorInput);
