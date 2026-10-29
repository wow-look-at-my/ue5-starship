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

// design-system/src/TextInput/TextInput.ts
function fieldOf(target) {
  return target instanceof HTMLInputElement && target.classList.contains("textinput__field") ? target : null;
}
var UeTextInputElement = class extends UeElement {
  setup() {
    for (const field of this.all(".textinput__field")) this.#sync(field);
    this.on(this, "input", (event) => {
      const field = fieldOf(event.target);
      if (field) this.#sync(field);
    });
    this.on(this, "click", (event) => {
      if (!(event.target instanceof Element)) return;
      const clear = event.target.closest(".textinput__clear");
      const box = event.target.closest(".textinput");
      const field = box?.querySelector(".textinput__field") ?? null;
      if (!box || !field) return;
      if (clear) this.#clear(field);
      else if (event.target !== field) field.focus();
    });
    this.on(this, "keydown", (event) => {
      const field = fieldOf(event.target);
      if (!field || event.key !== "Escape" || field.readOnly || field.value === "") return;
      if (!field.closest(".textinput--search")) return;
      event.preventDefault();
      this.#clear(field);
    });
  }
  #sync(field) {
    field.closest(".textinput--search")?.classList.toggle("textinput--filled", field.value !== "");
  }
  #clear(field) {
    field.value = "";
    this.#sync(field);
    field.focus();
    this.emit("ue-text-clear", {});
  }
};
define("ue-text-input", UeTextInputElement);
export {
  UeTextInputElement
};
