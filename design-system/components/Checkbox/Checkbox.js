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

// design-system/src/Checkbox/Checkbox.ts
function control(target) {
  return target instanceof Element ? target.closest(".checkbox, .checkbox-toggle") : null;
}
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
    if (el.classList.contains("checkbox-toggle")) {
      const on = !el.classList.contains("checkbox-toggle--checked");
      el.classList.toggle("checkbox-toggle--checked", on);
      el.setAttribute("aria-pressed", String(on));
      text = on ? "on" : "off";
    } else {
      const state = nextState(el);
      el.setAttribute("aria-checked", state);
      text = state === "mixed" ? "undetermined" : state === "true" ? "checked" : "unchecked";
    }
    const status = this.one(".checkbox-status");
    if (status) status.textContent = "Last change: " + (el.dataset.label ?? "") + " is " + text;
    this.emit("ue-checkbox-change", { label: el.dataset.label ?? "", state: text });
  }
};
define("ue-checkbox", UeCheckboxElement);
export {
  UeCheckboxElement
};
