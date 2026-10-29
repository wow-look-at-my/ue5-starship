// src/_shared/element.ts
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
  // True when the nearest element of this tag above the target is this element, so a nested instance keeps its own events.
  owns(target) {
    return target instanceof Element && target.closest(this.localName) === this;
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
var DEFAULT_MIN = 20;
var DEFAULT_STEP = 5;
var DEFAULT_STEP_LARGE = 20;
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
    const handle = this.all(".splitter-handle").find((candidate) => this.owns(candidate));
    if (!handle) throw new Error("ue-splitter needs a .splitter-handle between two panes");
    this.#wire(handle);
  }
  // A number attribute of this element, or the fallback when it is missing or not a number.
  #number(name, fallback) {
    const value = Number(this.getAttribute(name));
    return this.hasAttribute(name) && Number.isFinite(value) ? value : fallback;
  }
  #wire(handle) {
    let startSize = 0;
    let total = 0;
    const minStart = () => this.#number("data-min-start", DEFAULT_MIN);
    const minEnd = () => this.#number("data-min-end", DEFAULT_MIN);
    const resize = (size) => {
      const panes2 = panesOf(handle);
      if (!panes2) return;
      const clamped = Math.min(Math.max(size, minStart()), total - minEnd());
      panes2.before.style.flex = "0 0 " + clamped + "px";
      panes2.after.style.flex = "1 1 0";
      this.#publish(handle, panes2);
      this.emit("ue-splitter-resize", { size: clamped, total, orientation: panes2.vertical ? "vertical" : "horizontal" });
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
      const step = event.shiftKey ? this.#number("data-step-shift", DEFAULT_STEP_LARGE) : this.#number("data-step", DEFAULT_STEP);
      if (event.key === grow) resize(startSize + step);
      else if (event.key === shrink) resize(startSize - step);
      else if (event.key === "Home") resize(minStart());
      else if (event.key === "End") resize(total - minEnd());
      else return;
      event.preventDefault();
    });
  }
  // Publishes the position of the handle for assistive technology: the size of the pane before it.
  #publish(handle, panes) {
    const size = extent(panes.before, panes.vertical);
    const total = size + extent(panes.after, panes.vertical);
    handle.setAttribute("aria-valuemin", String(this.#number("data-min-start", DEFAULT_MIN)));
    handle.setAttribute("aria-valuemax", String(Math.round(total - this.#number("data-min-end", DEFAULT_MIN))));
    handle.setAttribute("aria-valuenow", String(Math.round(size)));
  }
};
define("ue-splitter", SplitterElement);
