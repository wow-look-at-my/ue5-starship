// <ue-vector-input> wraps VectorInput rows: X/Y/Z spin boxes, the reset arrow, the scale lock and the Relative / World menu.
import { UeElement, define } from '../_shared/element.ts';
import { drag } from '../_shared/drag.ts';
import { wireMenu } from '../_shared/popupmenu.ts';

const round = (value: number, places: number): number => Math.round(value * 10 ** places) / 10 ** places;

function format(value: number, unit: string): string {
	let text = String(round(value, 4));
	if (!text.includes('.')) text += '.0';
	return unit === '' ? text : text + ' ' + unit;
}

class UeVectorInput extends UeElement {
	protected setup(): void {
		for (const row of this.all('.VectorInput-row')) this.wireRow(row);
	}

	private wireRow(row: HTMLElement): void {
		const fields = Array.from(row.querySelectorAll<HTMLElement>('.VectorInput-field'));
		if (fields.length === 0) return;
		const reset = row.querySelector<HTMLButtonElement>('.VectorInput-reset');
		const lock = row.querySelector<HTMLButtonElement>('.VectorInput-lock');
		const unit = row.dataset.unit ?? '';
		const step = Number(row.dataset.step ?? '1');
		const defaults = (row.dataset.default ?? '').split(',').map(Number);

		const read = (): number[] => fields.map((field) => Number(field.dataset.value));
		const isLocked = (): boolean => lock?.classList.contains('is-locked') ?? false;
		const isEditing = (field: HTMLElement): boolean => field.classList.contains('is-editing');

		// Writes the values into the fields and shows the reset arrow only when a value differs from its default.
		const write = (values: number[], notify: boolean): void => {
			fields.forEach((field, i) => {
				field.dataset.value = String(values[i]);
				field.setAttribute('aria-valuenow', String(values[i]));
				const text = field.querySelector('.VectorInput-value-text');
				if (text && !isEditing(field)) text.textContent = format(values[i], unit);
			});
			const differs = values.some((value, i) => Math.abs(value - defaults[i]) > 1e-9);
			reset?.classList.toggle('is-placeholder', !differs);
			if (reset) reset.tabIndex = differs ? 0 : -1;
			if (notify) this.emit('ue-vector-change', { values });
		};

		// Sets one axis. With the scale lock on, the other axes keep their ratio to it from `basis`: ComponentTransformDetails.cpp:1377-1420.
		const change = (values: number[], index: number, next: number, basis: number[]): number[] => {
			const out = values.slice();
			out[index] = next;
			if (!isLocked()) return out;
			for (let j = 0; j < out.length; j++) {
				if (j !== index) out[j] = basis[index] === 0 ? next : (basis[j] * next) / basis[index];
			}
			return out;
		};

		fields.forEach((field, index) => this.wireField(field, index, { read, write, change, isEditing, step, unit }));

		if (reset) this.on(reset, 'click', () => write(defaults, true));
		if (lock) {
			this.on(lock, 'click', () => {
				const on = !isLocked();
				lock.classList.toggle('is-locked', on);
				lock.setAttribute('aria-pressed', String(on));
				lock.title = on ? 'Scale uniformly (locked)' : 'Scale uniformly (unlocked)';
				lock.querySelector('use')?.setAttribute('href', on ? '#VectorInput-locked' : '#VectorInput-unlock');
			});
		}

		const combo = row.querySelector<HTMLElement>('.VectorInput-combo');
		const menu = row.querySelector<HTMLElement>('.VectorInput-menu');
		if (combo && menu) {
			const handle = wireMenu({
				trigger: combo,
				menu,
				itemSelector: '.VectorInput-menuItem',
				onPick: (item) => {
					for (const other of menu.querySelectorAll('.VectorInput-menuItem')) other.setAttribute('aria-checked', String(other === item));
					this.emit('ue-vector-space', { space: (item.textContent ?? '').trim() });
				},
			});
			this.onDispose(handle.dispose);
		}

		write(read(), false);
	}

	private wireField(field: HTMLElement, index: number, row: RowApi): void {
		const text = field.querySelector<HTMLElement>('.VectorInput-value-text');
		if (!text) return;
		let startValues: number[] = [];
		let live = 0;
		let lastX = 0;
		let dragging = false;
		let cancelled = false;

		const leaveEdit = (): void => {
			field.classList.remove('is-editing', 'is-active');
			text.contentEditable = 'false';
		};
		const enterEdit = (): void => {
			field.classList.add('is-editing', 'is-active');
			text.contentEditable = 'plaintext-only';
			text.textContent = String(round(row.read()[index], 4));
			text.focus();
			const selection = window.getSelection();
			selection?.removeAllRanges();
			const range = document.createRange();
			range.selectNodeContents(text);
			selection?.addRange(range);
		};
		const commit = (refocus: boolean): void => {
			const raw = (text.textContent ?? '').replace(/[^0-9eE+.-]/g, '');
			const next = Number(raw);
			leaveEdit();
			const values = row.read();
			row.write(raw === '' || Number.isNaN(next) ? values : row.change(values, index, next, values), true);
			if (refocus) field.focus();
		};
		const cancelEdit = (): void => {
			leaveEdit();
			row.write(row.read(), false);
			field.focus();
		};

		// Release snaps to the step: SSpinBox.h:478-484.
		this.onDispose(
			drag(field, {
				start: (event) => {
					if (row.isEditing(field)) return;
					startValues = row.read();
					live = startValues[index];
					lastX = event.clientX;
					dragging = false;
					cancelled = false;
				},
				move: (event) => {
					if (row.isEditing(field) || cancelled) return;
					if (!dragging) {
						dragging = true;
						lastX = event.clientX;
						field.classList.add('is-active');
						return;
					}
					const dx = event.clientX - lastX;
					lastX = event.clientX;
					const width = Math.max(field.getBoundingClientRect().width, 100);
					live += Math.sign(dx) * (Math.abs(dx) / width) * Math.max(Math.abs(live), 1);
					row.write(row.change(row.read(), index, live, startValues), false);
				},
				end: () => {
					if (row.isEditing(field)) return;
					if (!dragging) {
						enterEdit();
						return;
					}
					dragging = false;
					field.classList.remove('is-active');
					if (cancelled) return;
					const snapped = round(Math.round(live / row.step) * row.step, 6);
					row.write(row.change(row.read(), index, snapped, startValues), true);
				},
			}),
		);

		// Escape cancels a drag in progress and restores the values from before it: SSpinBox.h:817-820.
		this.on(document, 'keydown', (event) => {
			if (event.key !== 'Escape' || !dragging || cancelled) return;
			cancelled = true;
			field.classList.remove('is-active');
			row.write(startValues, true);
		});

		// Arrow keys step by the row delta, Enter starts typing: SSpinBox.h:822-846.
		this.on(field, 'keydown', (event) => {
			if (row.isEditing(field)) return;
			let sign = 0;
			if (event.key === 'ArrowUp' || event.key === 'ArrowRight') sign = 1;
			else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') sign = -1;
			else if (event.key === 'Enter') {
				event.preventDefault();
				enterEdit();
				return;
			}
			if (sign === 0) return;
			event.preventDefault();
			const values = row.read();
			row.write(row.change(values, index, round(values[index] + sign * row.step, 6), values), true);
		});

		this.on(text, 'keydown', (event) => {
			if (event.key === 'Enter') commit(true);
			else if (event.key === 'Escape') cancelEdit();
			else {
				event.stopPropagation();
				return;
			}
			event.preventDefault();
			event.stopPropagation();
		});
		this.on(text, 'blur', () => {
			if (row.isEditing(field)) commit(false);
		});
	}
}

interface RowApi {
	read: () => number[];
	write: (values: number[], notify: boolean) => void;
	change: (values: number[], index: number, next: number, basis: number[]) => number[];
	isEditing: (field: HTMLElement) => boolean;
	step: number;
	unit: string;
}

define('ue-vector-input', UeVectorInput);
