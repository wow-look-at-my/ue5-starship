// Scrollbar thumb geometry (SScrollBarTrack.h:57-62, SScrollBar.cpp:219-226) and a bar that drives a scroll view.
import { drag } from './drag.ts';

// Smallest thumb length, SScrollBarTrack.cpp:12.
export const MIN_THUMB = 35;
// Padding between the slot edge and the track, SScrollBar.h:32.
export const BAR_PADDING = 2;

export interface ThumbLayout {
	needed: boolean;
	start: number;
	size: number;
}

// Thumb start and size in slot coordinates, for a slot of `slot` pixels along the scroll axis.
export function thumbLayout(slot: number, viewport: number, content: number, offset: number): ThumbLayout {
	const track = slot - 2 * BAR_PADDING;
	const biased = track - MIN_THUMB;
	const needed = content > viewport + 0.5 && biased > 0;
	if (!needed) return { needed: false, start: BAR_PADDING, size: 0 };
	return {
		needed,
		start: BAR_PADDING + biased * (offset / content),
		size: MIN_THUMB + biased * (viewport / content),
	};
}

// The scroll offset a pointer position maps to. `pointer` is in slot coordinates, `grab` is the offset inside the thumb.
export function offsetForPointer(pointer: number, grab: number, slot: number, content: number): number {
	const biased = slot - 2 * BAR_PADDING - MIN_THUMB;
	const fraction = Math.min(1, Math.max(0, (pointer - BAR_PADDING - grab) / biased));
	return fraction * content;
}

// Keeps a bar, its thumb and a scrollable view in step. Returns a function that removes everything it added.
export interface BarBinding {
	// Re-reads the sizes after the content changed without the view resizing.
	update: () => void;
	dispose: () => void;
}

// The bar hides while the content fits (SScrollBar.cpp:323-343). `onFits` runs when that state changes.
export function bindBar(view: HTMLElement, bar: HTMLElement, thumb: HTMLElement, vertical: boolean, onFits?: (fits: boolean) => void): BarBinding {
	const slotLength = (): number => (vertical ? bar.clientHeight : bar.clientWidth);
	const viewport = (): number => (vertical ? view.clientHeight : view.clientWidth);
	const content = (): number => (vertical ? view.scrollHeight : view.scrollWidth);
	const offset = (): number => (vertical ? view.scrollTop : view.scrollLeft);
	const scrollTo = (value: number): void => {
		const max = content() - viewport();
		const clamped = Math.min(max, Math.max(0, value));
		if (vertical) view.scrollTop = clamped;
		else view.scrollLeft = clamped;
	};
	const pointerIn = (event: PointerEvent): number => {
		const box = bar.getBoundingClientRect();
		return vertical ? event.clientY - box.top : event.clientX - box.left;
	};

	const update = (): void => {
		const fits = !(content() > viewport() + 0.5);
		if (bar.hidden !== fits) {
			bar.hidden = fits;
			onFits?.(fits);
		}
		if (fits) return;
		const layout = thumbLayout(slotLength(), viewport(), content(), offset());
		thumb.style.display = layout.needed ? '' : 'none';
		if (!layout.needed) return;
		if (vertical) {
			thumb.style.top = layout.start + 'px';
			thumb.style.height = layout.size + 'px';
		} else {
			thumb.style.left = layout.start + 'px';
			thumb.style.width = layout.size + 'px';
		}
	};

	let grab = 0;
	const stopDrag = drag(bar, {
		start: (event) => {
			const box = thumb.getBoundingClientRect();
			const thumbStart = vertical ? box.top : box.left;
			const pointer = vertical ? event.clientY : event.clientX;
			const onThumb = thumb.style.display !== 'none' && pointer >= thumbStart && pointer <= thumbStart + (vertical ? box.height : box.width);
			bar.classList.add('is-drag');
			if (thumb.style.display === 'none') return;
			grab = onThumb ? pointer - thumbStart : (vertical ? box.height : box.width) / 2;
			if (!onThumb) scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content()));
		},
		move: (event) => scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content())),
		end: () => bar.classList.remove('is-drag'),
	});

	const onScroll = (): void => update();
	const onWheel = (event: WheelEvent): void => {
		event.preventDefault();
		view.scrollBy(vertical ? { top: event.deltaY } : { left: event.deltaX || event.deltaY });
	};
	view.addEventListener('scroll', onScroll);
	bar.addEventListener('wheel', onWheel, { passive: false });
	const observer = new ResizeObserver(update);
	observer.observe(view);
	observer.observe(bar);
	// The content can grow without the view resizing, for example when a web font loads.
	for (const child of Array.from(view.children)) observer.observe(child);
	// A child added to or removed from the view changes the content size without resizing the view.
	const mutations = new MutationObserver((records) => {
		for (const record of records) for (const added of Array.from(record.addedNodes)) if (added instanceof Element) observer.observe(added);
		update();
	});
	mutations.observe(view, { childList: true });
	update();

	return {
		update,
		dispose: () => {
			stopDrag();
			view.removeEventListener('scroll', onScroll);
			bar.removeEventListener('wheel', onWheel);
			observer.disconnect();
			mutations.disconnect();
		},
	};
}
