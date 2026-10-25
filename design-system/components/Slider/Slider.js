// design-system/src/_shared/element.ts
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

// design-system/src/Slider/Slider.ts
var HANDLE = 8;
function sliderOf(target) {
  return target instanceof Element ? target.closest('.slider[role="slider"]') : null;
}
function attr(el, name, fallback) {
  const raw = el.dataset[name];
  const value = raw === void 0 ? NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}
var UeSliderElement = class extends UeElement {
  #dragging = /* @__PURE__ */ new WeakSet();
  setup() {
    for (const slider of this.all('.slider[role="slider"]')) this.#render(slider);
    this.on(this, "pointerdown", (event) => {
      const slider = sliderOf(event.target);
      if (!slider || event.button !== 0 || slider.getAttribute("aria-disabled") === "true") return;
      slider.setPointerCapture(event.pointerId);
      this.#dragging.add(slider);
      slider.focus();
      this.#fromPointer(slider, event.clientX);
      event.preventDefault();
    });
    this.on(this, "pointermove", (event) => {
      const slider = sliderOf(event.target);
      if (slider && this.#dragging.has(slider)) this.#fromPointer(slider, event.clientX);
    });
    const release = (event) => {
      const slider = sliderOf(event.target);
      if (!slider) return;
      this.#dragging.delete(slider);
      if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
    };
    this.on(this, "pointerup", release);
    this.on(this, "pointercancel", release);
    this.on(this, "keydown", (event) => {
      const slider = sliderOf(event.target);
      if (!slider || slider.getAttribute("aria-disabled") === "true") return;
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
    if (changed) this.emit("ue-slider-change", { value });
  }
  #render(slider) {
    const min = attr(slider, "min", 0);
    const max = attr(slider, "max", 1);
    const value = attr(slider, "value", min);
    slider.setAttribute("aria-valuemin", String(min));
    slider.setAttribute("aria-valuemax", String(max));
    slider.setAttribute("aria-valuenow", String(value));
    slider.style.setProperty("--slider-value", String(max === min ? 0 : (value - min) / (max - min)));
    const caption = slider.nextElementSibling;
    if (caption instanceof HTMLElement && caption.classList.contains("slider-value")) {
      const step = attr(slider, "step", 0);
      caption.textContent = step > 0 && step < 1 ? value.toFixed(2) : String(value);
    }
  }
};
define("ue-slider", UeSliderElement);
export {
  UeSliderElement
};
