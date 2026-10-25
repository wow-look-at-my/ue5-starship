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

// design-system/src/SpinBox/SpinBox.ts
var DRAG_TRIGGER = 5;
var MIN_SLIDER_WIDTH = 100;
function numberAttr(el, name) {
  const raw = el.dataset[name];
  if (raw === void 0 || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function rangeOf(box) {
  const min = numberAttr(box, "min");
  const max = numberAttr(box, "max");
  return { min: min ?? -Infinity, max: max ?? Infinity, bounded: min !== null && max !== null, delta: numberAttr(box, "delta") ?? 0 };
}
function valueOf(box) {
  return numberAttr(box, "value") ?? 0;
}
function format(value) {
  const rounded = Math.round(value * 1e3) / 1e3;
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}
function clamp(value, range) {
  return Math.min(range.max, Math.max(range.min, value));
}
function boxOf(target) {
  return target instanceof Element ? target.closest(".spinbox") : null;
}
var UeSpinBoxElement = class extends UeElement {
  #drags = /* @__PURE__ */ new WeakMap();
  setup() {
    for (const box of this.all(".spinbox")) this.#render(box);
    this.on(this, "pointerdown", (event) => {
      const box = boxOf(event.target);
      if (!box || event.button !== 0 || box.getAttribute("aria-disabled") === "true") return;
      if (box.classList.contains("spinbox--text")) return;
      box.setPointerCapture(event.pointerId);
      this.#drags.set(box, { pointerId: event.pointerId, lastX: event.clientX, distance: 0, dragging: false, before: valueOf(box), internal: valueOf(box) });
      box.focus();
      event.preventDefault();
    });
    this.on(this, "pointermove", (event) => {
      const box = boxOf(event.target);
      const state = box ? this.#drags.get(box) : void 0;
      if (!box || !state || state.pointerId !== event.pointerId) return;
      const dx = event.clientX - state.lastX;
      state.lastX = event.clientX;
      if (!state.dragging) {
        state.distance += Math.abs(dx);
        if (state.distance > DRAG_TRIGGER) {
          state.dragging = true;
          box.classList.add("spinbox--active");
        }
        return;
      }
      this.#drag(box, state, dx);
    });
    const finish = (event) => {
      const box = boxOf(event.target);
      const state = box ? this.#drags.get(box) : void 0;
      if (!box || !state || state.pointerId !== event.pointerId) return;
      this.#drags.delete(box);
      if (box.hasPointerCapture(event.pointerId)) box.releasePointerCapture(event.pointerId);
      box.classList.remove("spinbox--active");
      if (event.type === "pointercancel") return;
      if (state.dragging) {
        const range = rangeOf(box);
        if (range.delta > 0) this.#set(box, clamp(Math.round(valueOf(box) / range.delta) * range.delta, range));
      } else {
        this.#enterText(box);
      }
    };
    this.on(this, "pointerup", finish);
    this.on(this, "pointercancel", finish);
    this.on(this, "keydown", (event) => {
      const box = boxOf(event.target);
      if (!box || box.getAttribute("aria-disabled") === "true") return;
      const state = this.#drags.get(box);
      if (event.key === "Escape" && state?.dragging) {
        this.#drags.delete(box);
        if (box.hasPointerCapture(state.pointerId)) box.releasePointerCapture(state.pointerId);
        box.classList.remove("spinbox--active");
        this.#set(box, state.before);
        event.preventDefault();
        return;
      }
      if (event.target !== box) return;
      const range = rangeOf(box);
      if (event.key === "ArrowUp" || event.key === "ArrowRight") this.#set(box, clamp(valueOf(box) + range.delta, range));
      else if (event.key === "ArrowDown" || event.key === "ArrowLeft") this.#set(box, clamp(valueOf(box) - range.delta, range));
      else if (event.key === "Enter") this.#enterText(box);
      else return;
      event.preventDefault();
    });
    this.on(this, "focusout", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.classList.contains("spinbox__field")) {
        const box = boxOf(event.target);
        if (box) this.#exitText(box, true, false);
      }
    });
  }
  // The value change of one mouse move while dragging, from SSpinBox::OnMouseMove.
  #drag(box, state, dx) {
    const range = rangeOf(box);
    const width = Math.max(box.getBoundingClientRect().width, MIN_SLIDER_WIDTH);
    let next;
    if (range.bounded) {
      const step = range.max - range.min <= 10 ? 0.1 : 1;
      const filled = Math.min(width, Math.max(0, (state.internal - range.min) / (range.max - range.min) * width + dx * step));
      next = range.min + filled / width * (range.max - range.min);
    } else {
      const sign = dx > 0 ? 1 : -1;
      next = state.internal + sign * (Math.abs(dx) / width) * Math.max(Math.abs(state.internal), 1);
    }
    state.internal = clamp(next, range);
    this.#set(box, state.internal);
  }
  #set(box, value) {
    const before = valueOf(box);
    box.dataset.value = String(value);
    this.#render(box);
    if (value !== before) {
      const status = this.one(".spinbox-status");
      if (status) status.textContent = "Last change: " + format(value);
      this.emit("ue-spin-change", { value });
    }
  }
  #render(box) {
    const range = rangeOf(box);
    const value = valueOf(box);
    box.setAttribute("aria-valuenow", String(value));
    if (range.bounded) {
      box.setAttribute("aria-valuemin", String(range.min));
      box.setAttribute("aria-valuemax", String(range.max));
      box.style.setProperty("--spinbox-fill", String((value - range.min) / (range.max - range.min)));
    }
    const text = box.querySelector(".spinbox__text");
    if (text && !box.classList.contains("spinbox--text")) text.textContent = format(value);
  }
  #enterText(box) {
    const text = box.querySelector(".spinbox__text");
    if (!text) return;
    box.classList.add("spinbox--text");
    const field = document.createElement("input");
    field.className = "spinbox__field";
    field.type = "text";
    field.value = format(valueOf(box));
    field.setAttribute("aria-label", "Value");
    text.replaceChildren(field);
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.#exitText(box, true, true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.#exitText(box, false, true);
      }
    });
    field.focus();
    field.select();
  }
  #exitText(box, commit, refocus) {
    const field = box.querySelector(".spinbox__field");
    if (!field || !box.classList.contains("spinbox--text")) return;
    const typed = Number(field.value.trim());
    box.classList.remove("spinbox--text");
    const range = rangeOf(box);
    if (commit && field.value.trim() !== "" && Number.isFinite(typed)) this.#set(box, clamp(typed, range));
    else this.#render(box);
    if (refocus) box.focus();
  }
};
define("ue-spin-box", UeSpinBoxElement);
export {
  UeSpinBoxElement
};
