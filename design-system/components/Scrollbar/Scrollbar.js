// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
  #ready = false;
  #pendingSetup = null;
  // The bundle can load before the parser reaches this element's children, so setup waits for the document to finish parsing.
  connectedCallback() {
    this.style.display = "contents";
    if (document.readyState !== "loading") {
      this.#start();
      return;
    }
    this.#pendingSetup = () => this.#start();
    document.addEventListener("DOMContentLoaded", this.#pendingSetup, { once: true });
  }
  disconnectedCallback() {
    if (this.#pendingSetup) document.removeEventListener("DOMContentLoaded", this.#pendingSetup);
    this.#pendingSetup = null;
    this.#ready = false;
    for (const dispose of this.#disposers.splice(0)) dispose();
  }
  #start() {
    this.#pendingSetup = null;
    if (this.#ready || !this.isConnected) return;
    this.#ready = true;
    this.setup();
  }
  on(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this.#disposers.push(() => target.removeEventListener(type, listener, options));
  }
  // Registers a cleanup that runs when the element disconnects.
  onDispose(dispose) {
    this.#disposers.push(dispose);
  }
  emit(name, detail) {
    return this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
  all(selector) {
    return Array.from(this.querySelectorAll(selector));
  }
  one(selector) {
    return this.querySelector(selector);
  }
};
function define(tag, ctor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

// design-system/src/_shared/drag.ts
var THRESHOLD = 3;
function drag(target, handlers) {
  let originX = 0;
  let originY = 0;
  let active = false;
  let moved = false;
  const down = (event) => {
    if (event.button !== 0) return;
    active = true;
    moved = false;
    originX = event.clientX;
    originY = event.clientY;
    target.setPointerCapture(event.pointerId);
    handlers.start?.(event);
  };
  const move = (event) => {
    if (!active) return;
    const dx = event.clientX - originX;
    const dy = event.clientY - originY;
    if (!moved && Math.hypot(dx, dy) < THRESHOLD) return;
    moved = true;
    handlers.move(event, dx, dy);
  };
  const up = (event) => {
    if (!active) return;
    active = false;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    handlers.end?.(event, moved);
  };
  target.addEventListener("pointerdown", down);
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
  return () => {
    target.removeEventListener("pointerdown", down);
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
  };
}

// design-system/src/_shared/scroll-thumb.ts
var MIN_THUMB = 35;
var BAR_PADDING = 2;
function thumbLayout(slot, viewport, content, offset) {
  const track = slot - 2 * BAR_PADDING;
  const biased = track - MIN_THUMB;
  const needed = content > viewport + 0.5 && biased > 0;
  if (!needed) return { needed: false, start: BAR_PADDING, size: 0 };
  return {
    needed,
    start: BAR_PADDING + biased * (offset / content),
    size: MIN_THUMB + biased * (viewport / content)
  };
}
function offsetForPointer(pointer, grab, slot, content) {
  const biased = slot - 2 * BAR_PADDING - MIN_THUMB;
  const fraction = Math.min(1, Math.max(0, (pointer - BAR_PADDING - grab) / biased));
  return fraction * content;
}
function bindBar(view, bar, thumb, vertical, onFits) {
  const slotLength = () => vertical ? bar.clientHeight : bar.clientWidth;
  const viewport = () => vertical ? view.clientHeight : view.clientWidth;
  const content = () => vertical ? view.scrollHeight : view.scrollWidth;
  const offset = () => vertical ? view.scrollTop : view.scrollLeft;
  const scrollTo = (value) => {
    const max = content() - viewport();
    const clamped = Math.min(max, Math.max(0, value));
    if (vertical) view.scrollTop = clamped;
    else view.scrollLeft = clamped;
  };
  const pointerIn = (event) => {
    const box = bar.getBoundingClientRect();
    return vertical ? event.clientY - box.top : event.clientX - box.left;
  };
  const update = () => {
    const fits = !(content() > viewport() + 0.5);
    if (bar.hidden !== fits) {
      bar.hidden = fits;
      onFits?.(fits);
    }
    if (fits) return;
    const layout = thumbLayout(slotLength(), viewport(), content(), offset());
    thumb.style.display = layout.needed ? "" : "none";
    if (!layout.needed) return;
    if (vertical) {
      thumb.style.top = layout.start + "px";
      thumb.style.height = layout.size + "px";
    } else {
      thumb.style.left = layout.start + "px";
      thumb.style.width = layout.size + "px";
    }
  };
  let grab = 0;
  const stopDrag = drag(bar, {
    start: (event) => {
      const box = thumb.getBoundingClientRect();
      const thumbStart = vertical ? box.top : box.left;
      const pointer = vertical ? event.clientY : event.clientX;
      const onThumb = thumb.style.display !== "none" && pointer >= thumbStart && pointer <= thumbStart + (vertical ? box.height : box.width);
      bar.classList.add("is-drag");
      if (thumb.style.display === "none") return;
      grab = onThumb ? pointer - thumbStart : (vertical ? box.height : box.width) / 2;
      if (!onThumb) scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content()));
    },
    move: (event) => scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content())),
    end: () => bar.classList.remove("is-drag")
  });
  const onScroll = () => update();
  const onWheel = (event) => {
    event.preventDefault();
    view.scrollBy(vertical ? { top: event.deltaY } : { left: event.deltaX || event.deltaY });
  };
  view.addEventListener("scroll", onScroll);
  bar.addEventListener("wheel", onWheel, { passive: false });
  const observer = new ResizeObserver(update);
  observer.observe(view);
  observer.observe(bar);
  update();
  return {
    update,
    dispose: () => {
      stopDrag();
      view.removeEventListener("scroll", onScroll);
      bar.removeEventListener("wheel", onWheel);
      observer.disconnect();
    }
  };
}

// design-system/src/Scrollbar/Scrollbar.ts
var Scrollbar = class extends UeElement {
  setup() {
    for (const box of this.all(".sb-scroll")) {
      const view = box.querySelector(".sb-view");
      const bar = box.querySelector(".sb");
      const thumb = bar?.querySelector(".sb-thumb");
      if (!view || !bar || !thumb) continue;
      const vertical = !bar.classList.contains("sb-h");
      this.onDispose(bindBar(view, bar, thumb, vertical).dispose);
    }
  }
};
define("ue-scrollbar", Scrollbar);
export {
  Scrollbar
};
