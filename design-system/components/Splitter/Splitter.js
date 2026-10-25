// src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
  connectedCallback() {
    this.style.display = "contents";
    this.setup();
  }
  disconnectedCallback() {
    for (const dispose of this.#disposers.splice(0)) dispose();
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

// src/_shared/drag.ts
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

// src/Splitter/Splitter.ts
var MIN_PANE = 20;
var KEY_STEP = 5;
var KEY_STEP_LARGE = 20;
var HIGHLIGHT = "splitter-handle--highlight";
function panesOf(handle) {
  const before = handle.previousElementSibling;
  const after = handle.nextElementSibling;
  if (!(before instanceof HTMLElement) || !(after instanceof HTMLElement) || !handle.parentElement) return null;
  return { before, after, vertical: getComputedStyle(handle.parentElement).flexDirection === "column" };
}
var extent = (pane, vertical) => pane.getBoundingClientRect()[vertical ? "height" : "width"];
var SplitterElement = class extends UeElement {
  setup() {
    for (const handle of this.all(".splitter-handle")) {
      if (handle.hasAttribute("data-pinned")) continue;
      this.#wire(handle);
    }
  }
  #wire(handle) {
    let startSize = 0;
    let total = 0;
    const resize = (size) => {
      const panes2 = panesOf(handle);
      if (!panes2) return;
      const clamped = Math.min(Math.max(size, MIN_PANE), total - MIN_PANE);
      panes2.before.style.flex = "0 0 " + clamped + "px";
      panes2.after.style.flex = "1 1 0";
      this.#publish(handle, panes2);
    };
    const measure = () => {
      const panes2 = panesOf(handle);
      if (!panes2) return null;
      startSize = extent(panes2.before, panes2.vertical);
      total = startSize + extent(panes2.after, panes2.vertical);
      return panes2;
    };
    const panes = panesOf(handle);
    if (panes) {
      handle.setAttribute("aria-orientation", panes.vertical ? "horizontal" : "vertical");
      this.#publish(handle, panes);
    }
    this.onDispose(drag(handle, {
      start: () => {
        measure();
        handle.classList.add(HIGHLIGHT);
      },
      move: (_event, dx, dy) => {
        const current = panesOf(handle);
        if (current) resize(startSize + (current.vertical ? dy : dx));
      },
      end: () => handle.classList.remove(HIGHLIGHT)
    }));
    this.on(handle, "keydown", (event) => {
      const current = measure();
      if (!current) return;
      const grow = current.vertical ? "ArrowDown" : "ArrowRight";
      const shrink = current.vertical ? "ArrowUp" : "ArrowLeft";
      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
      if (event.key === grow) resize(startSize + step);
      else if (event.key === shrink) resize(startSize - step);
      else if (event.key === "Home") resize(MIN_PANE);
      else if (event.key === "End") resize(total - MIN_PANE);
      else return;
      event.preventDefault();
    });
  }
  // Publishes the position of the handle for assistive technology: the size of the pane before it.
  #publish(handle, panes) {
    const size = extent(panes.before, panes.vertical);
    const total = size + extent(panes.after, panes.vertical);
    handle.setAttribute("aria-valuemin", String(MIN_PANE));
    handle.setAttribute("aria-valuemax", String(Math.round(total - MIN_PANE)));
    handle.setAttribute("aria-valuenow", String(Math.round(size)));
  }
};
define("ue-splitter", SplitterElement);
