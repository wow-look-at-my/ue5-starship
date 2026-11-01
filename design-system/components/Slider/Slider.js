// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
  #ready = false;
  #pendingSetup = null;
  // The bundle can load before the parser reaches this element's children, so setup waits for the document to finish parsing.
  // A pinned specimen (data-pinned on the element or an ancestor) keeps its authored markup: setup never runs.
  connectedCallback() {
    this.style.display = "contents";
    if (this.closest("[data-pinned]")) return;
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

// design-system/src/Slider/Slider.ts
var HANDLE = 8;
function attr(el, name, fallback) {
  const raw = el.dataset[name];
  const value = raw === void 0 ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}
var UeSliderElement = class extends UeElement {
  #dragging = /* @__PURE__ */ new WeakSet();
  setup() {
    const slider = this.one('.slider[role="slider"]');
    if (!slider) throw new Error('ue-slider needs a .slider[role="slider"] element');
    this.#render(slider);
    this.on(slider, "pointerdown", (event) => {
      if (event.button !== 0 || slider.getAttribute("aria-disabled") === "true") return;
      slider.setPointerCapture(event.pointerId);
      this.#dragging.add(slider);
      slider.focus();
      this.#fromPointer(slider, event.clientX);
      event.preventDefault();
    });
    this.on(slider, "pointermove", (event) => {
      if (this.#dragging.has(slider)) this.#fromPointer(slider, event.clientX);
    });
    const release = (event) => {
      this.#dragging.delete(slider);
      if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
    };
    this.on(slider, "pointerup", release);
    this.on(slider, "pointercancel", release);
    this.on(slider, "keydown", (event) => {
      if (slider.getAttribute("aria-disabled") === "true") return;
      const min = attr(slider, "min", 0);
      const max = attr(slider, "max", 1);
      const step = attr(slider, "step", (max - min) / 100);
      const value = attr(slider, "value", min);
      let next;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = value + step;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = value - step;
          break;
        case "PageUp":
          next = value + step * 10;
          break;
        case "PageDown":
          next = value - step * 10;
          break;
        case "Home":
          next = min;
          break;
        case "End":
          next = max;
          break;
        default:
          return;
      }
      event.preventDefault();
      this.#set(slider, next);
    });
  }
  // The thumb centre runs from HANDLE to width minus HANDLE, SSlider.cpp:84-91.
  #fromPointer(slider, clientX) {
    const rect = slider.getBoundingClientRect();
    const travel = rect.width - 2 * HANDLE;
    const fraction = travel <= 0 ? 0 : (clientX - rect.left - HANDLE) / travel;
    const min = attr(slider, "min", 0);
    const max = attr(slider, "max", 1);
    this.#set(slider, min + Math.min(1, Math.max(0, fraction)) * (max - min));
  }
  #set(slider, raw) {
    const min = attr(slider, "min", 0);
    const max = attr(slider, "max", 1);
    const step = attr(slider, "step", 0);
    let value = Math.min(max, Math.max(min, raw));
    if (step > 0) value = Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
    value = Math.round(value * 1e6) / 1e6;
    const changed = value !== attr(slider, "value", min);
    slider.dataset.value = String(value);
    this.#render(slider);
    if (changed) this.emit("ue-slider-change", { value, text: step > 0 && step < 1 ? value.toFixed(2) : String(value) });
  }
  #render(slider) {
    const min = attr(slider, "min", 0);
    const max = attr(slider, "max", 1);
    const value = attr(slider, "value", min);
    slider.setAttribute("aria-valuemin", String(min));
    slider.setAttribute("aria-valuemax", String(max));
    slider.setAttribute("aria-valuenow", String(value));
    slider.style.setProperty("--slider-value", String(max === min ? 0 : (value - min) / (max - min)));
  }
};
define("ue-slider", UeSliderElement);
export {
  UeSliderElement
};
