// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
<<<<<<< HEAD
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
=======
  connectedCallback() {
    this.style.display = "contents";
    this.setup();
  }
  disconnectedCallback() {
    for (const dispose of this.#disposers.splice(0)) dispose();
  }
>>>>>>> origin/master
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
<<<<<<< HEAD
  // True when the nearest element of this tag above the target is this element, so a nested instance keeps its own events.
  owns(target) {
    return target instanceof Element && target.closest(this.localName) === this;
  }
=======
>>>>>>> origin/master
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

// design-system/src/Checkbox/Checkbox.ts
<<<<<<< HEAD
=======
function control(target) {
  return target instanceof Element ? target.closest(".checkbox, .checkbox-toggle") : null;
}
>>>>>>> origin/master
function disabled(el) {
  return el.getAttribute("aria-disabled") === "true";
}
function nextState(el) {
  const state = el.getAttribute("aria-checked");
  if (el.classList.contains("checkbox--tristate")) {
    if (state === "false") return "true";
    return state === "true" ? "mixed" : "false";
  }
  return state === "true" ? "false" : "true";
}
var UeCheckboxElement = class extends UeElement {
  setup() {
<<<<<<< HEAD
    const el = this.one(".checkbox, .checkbox-toggle");
    if (!el) throw new Error("ue-checkbox needs a .checkbox or .checkbox-toggle element");
    const pressedClass = el.classList.contains("checkbox") ? "checkbox--pressed" : "checkbox-toggle--pressed";
    this.on(el, "click", () => {
      if (!disabled(el)) this.#toggle(el);
    });
    this.on(el, "keydown", (event) => {
      if (disabled(el) || el !== event.target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) el.classList.add(pressedClass);
    });
    this.on(el, "keyup", (event) => {
      if (disabled(el) || el !== event.target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      if (el.classList.contains(pressedClass)) {
        el.classList.remove(pressedClass);
        this.#toggle(el);
      }
    });
    this.on(el, "focusout", () => el.classList.remove(pressedClass));
  }
  #toggle(el) {
    let text;
    let checked;
=======
    this.on(this, "click", (event) => {
      const el = control(event.target);
      if (el && !disabled(el)) this.#toggle(el);
    });
    this.on(this, "keydown", (event) => {
      const el = control(event.target);
      if (!el || disabled(el) || el !== event.target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) el.classList.add(el.classList.contains("checkbox") ? "checkbox--pressed" : "checkbox-toggle--pressed");
    });
    this.on(this, "keyup", (event) => {
      const el = control(event.target);
      if (!el || disabled(el) || el !== event.target) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const cls = el.classList.contains("checkbox") ? "checkbox--pressed" : "checkbox-toggle--pressed";
      if (el.classList.contains(cls)) {
        el.classList.remove(cls);
        this.#toggle(el);
      }
    });
    this.on(this, "focusout", (event) => {
      const el = control(event.target);
      if (el) el.classList.remove("checkbox--pressed", "checkbox-toggle--pressed");
    });
  }
  #toggle(el) {
    let text;
>>>>>>> origin/master
    if (el.classList.contains("checkbox-toggle")) {
      const on = !el.classList.contains("checkbox-toggle--checked");
      el.classList.toggle("checkbox-toggle--checked", on);
      el.setAttribute("aria-pressed", String(on));
      text = on ? "on" : "off";
<<<<<<< HEAD
      checked = on;
=======
>>>>>>> origin/master
    } else {
      const state = nextState(el);
      el.setAttribute("aria-checked", state);
      text = state === "mixed" ? "undetermined" : state === "true" ? "checked" : "unchecked";
<<<<<<< HEAD
      checked = state === "mixed" ? null : state === "true";
    }
    const label = el.dataset.label ?? el.getAttribute("aria-label") ?? el.querySelector(".checkbox__label")?.textContent?.trim() ?? el.textContent?.trim() ?? "";
    this.emit("ue-checkbox-change", { label, state: text, checked, text: label + " is " + text });
=======
    }
    const status = this.one(".checkbox-status");
    if (status) status.textContent = "Last change: " + (el.dataset.label ?? "") + " is " + text;
    this.emit("ue-checkbox-change", { label: el.dataset.label ?? "", state: text });
>>>>>>> origin/master
  }
};
define("ue-checkbox", UeCheckboxElement);
export {
  UeCheckboxElement
};
