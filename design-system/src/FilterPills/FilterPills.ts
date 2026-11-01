// <ue-filter-pills> wraps one .FilterPills-strip. Pills form a tablist with one active pill and roving focus. Chips are removable filters.
import { UeElement, define } from '../_shared/element.ts';
import './FilterPills.css';

const CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

export interface PillData {
	value: string;
	label: string;
	checked?: boolean;
}

export interface ChipData {
	id: string;
	label: string;
	// CSS colour of the segment on the left edge. Defaults to grey.
	color?: string;
}

export interface FilterChangeDetail {
	value: string;
	label: string;
}

export interface PillRemoveDetail {
	id: string;
	label: string;
}

export class UeFilterPills extends UeElement {
	#strip: HTMLElement | null = null;

	protected setup(): void {
		const strip = this.all('.FilterPills-strip').find((candidate) => this.owns(candidate)) ?? this.#createStrip();
		this.#strip = strip;
		this.on(strip, 'click', (event) => {
			if (!this.owns(event.target)) return;
			const target = event.target as Element;
			const remove = target.closest<HTMLElement>('.FilterPills-chipRemove');
			const chip = remove?.closest<HTMLElement>('.FilterPills-chip');
			if (chip) {
				this.removeChip(this.#chipId(chip));
				return;
			}
			const pill = target.closest<HTMLElement>('.FilterPills-pill');
			if (pill && strip.contains(pill)) this.#select(pill, false);
		});
		this.on(strip, 'keydown', (event) => {
			if (!this.owns(event.target)) return;
			const pills = this.#pills();
			const at = pills.indexOf(document.activeElement as HTMLElement);
			if (at < 0) return;
			let next = -1;
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % pills.length;
			else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + pills.length) % pills.length;
			else if (event.key === 'Home') next = 0;
			else if (event.key === 'End') next = pills.length - 1;
			if (next < 0) return;
			event.preventDefault();
			this.#select(pills[next], true);
		});
		if (this.#pills().length > 0 && !strip.hasAttribute('role')) strip.setAttribute('role', 'tablist');
		if (strip.classList.contains('FilterPills-strip--chips')) strip.setAttribute('role', 'list');
	}

	#createStrip(): HTMLElement {
		const strip = document.createElement('div');
		strip.className = 'FilterPills-strip';
		this.append(strip);
		return strip;
	}

	#pills(): HTMLElement[] {
		return Array.from(this.#strip?.querySelectorAll<HTMLElement>('.FilterPills-pill') ?? []);
	}

	#chips(): HTMLElement[] {
		return Array.from(this.#strip?.querySelectorAll<HTMLElement>('.FilterPills-chip') ?? []);
	}

	#valueOf(pill: HTMLElement): string {
		return pill.dataset.value ?? (pill.textContent ?? '').trim();
	}

	#chipId(chip: HTMLElement): string {
		return chip.dataset.id ?? (chip.querySelector('.FilterPills-chipName')?.textContent ?? '').trim();
	}

	// The value of the checked pill, or an empty string when no pill is checked.
	get value(): string {
		const checked = this.#pills().find((pill) => pill.classList.contains('is-checked'));
		return checked ? this.#valueOf(checked) : '';
	}

	// Checks the pill with this value. It fires ue-filter-change when that changes the checked pill.
	set value(value: string) {
		const pill = this.#pills().find((candidate) => this.#valueOf(candidate) === value);
		if (pill) this.#select(pill, false);
	}

	#select(pill: HTMLElement, focus: boolean): void {
		const changed = !pill.classList.contains('is-checked');
		for (const other of this.#pills()) {
			const on = other === pill;
			other.classList.toggle('is-checked', on);
			other.setAttribute('aria-selected', String(on));
			other.tabIndex = on ? 0 : -1;
		}
		if (focus) pill.focus();
		if (changed) this.emit<FilterChangeDetail>('ue-filter-change', { value: this.#valueOf(pill), label: (pill.textContent ?? '').trim() });
	}

	// Replaces every pill. The first pill with checked set is checked; with none, no pill is checked.
	setPills(pills: PillData[]): void {
		const strip = this.#strip;
		if (!strip) return;
		const drawn = pills.map((data) => {
			const pill = document.createElement('button');
			pill.type = 'button';
			pill.className = 'FilterPills-pill' + (data.checked ? ' is-checked' : '');
			pill.setAttribute('role', 'tab');
			pill.setAttribute('aria-selected', String(data.checked === true));
			pill.dataset.value = data.value;
			pill.textContent = data.label;
			return pill;
		});
		strip.replaceChildren(...drawn);
		strip.setAttribute('role', 'tablist');
		const stop = drawn.find((pill) => pill.classList.contains('is-checked')) ?? drawn[0];
		for (const pill of drawn) pill.tabIndex = pill === stop ? 0 : -1;
	}

	// The chips in order.
	getChips(): ChipData[] {
		return this.#chips().map((chip) => ({ id: this.#chipId(chip), label: (chip.querySelector('.FilterPills-chipName')?.textContent ?? '').trim(), color: chip.querySelector<HTMLElement>('.FilterPills-chipColor')?.style.background || undefined }));
	}

	// Adds a removable chip at the end. An id that is already there is ignored.
	addChip(data: ChipData): void {
		const strip = this.#strip;
		if (!strip || this.#chips().some((chip) => this.#chipId(chip) === data.id)) return;
		strip.classList.add('FilterPills-strip--chips');
		strip.setAttribute('role', 'list');
		const chip = document.createElement('span');
		chip.className = 'FilterPills-chip';
		chip.setAttribute('role', 'listitem');
		chip.dataset.id = data.id;
		chip.setAttribute('aria-label', 'Filter: ' + data.label);
		const color = document.createElement('span');
		color.className = 'FilterPills-chipColor';
		if (data.color) color.style.background = data.color;
		const name = document.createElement('span');
		name.className = 'FilterPills-chipName';
		name.textContent = data.label;
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'FilterPills-chipRemove';
		remove.setAttribute('aria-label', 'Remove ' + data.label + ' filter');
		remove.innerHTML = CROSS;
		chip.append(color, name, remove);
		strip.append(chip);
		strip.hidden = false;
		this.emit<ChipData>('ue-pill-add', { id: data.id, label: data.label, color: data.color });
	}

	// Removes the chip with this id. It fires ue-pill-remove.
	removeChip(id: string): void {
		const chip = this.#chips().find((candidate) => this.#chipId(candidate) === id);
		if (!chip) return;
		const detail: PillRemoveDetail = { id, label: (chip.querySelector('.FilterPills-chipName')?.textContent ?? '').trim() };
		chip.remove();
		if (this.#strip && this.#chips().length === 0) this.#strip.hidden = true;
		this.emit<PillRemoveDetail>('ue-pill-remove', detail);
	}

	// Replaces every chip. It fires ue-pill-add for each new chip and ue-pill-remove for each chip that was dropped.
	setChips(chips: ChipData[]): void {
		const wanted = new Set(chips.map((chip) => chip.id));
		for (const have of this.getChips()) if (!wanted.has(have.id)) this.removeChip(have.id);
		for (const chip of chips) this.addChip(chip);
	}
}

define('ue-filter-pills', UeFilterPills);
