// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
<<<<<<< HEAD
  connectedCallback() {
    this.style.display = "contents";
    this.setup();
  }
  disconnectedCallback() {
    for (const dispose of this.#disposers.splice(0)) dispose();
  }
=======
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
>>>>>>> claude/adoring-faraday-94vc0i
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
=======
  // True when the nearest element of this tag above the target is this element, so a nested instance keeps its own events.
  owns(target) {
    return target instanceof Element && target.closest(this.localName) === this;
  }
>>>>>>> claude/adoring-faraday-94vc0i
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
<<<<<<< HEAD
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
=======
var UeTextInputElement = class extends UeElement {
  setup() {
    const box = this.one(".textinput");
    const field = box?.querySelector(".textinput__field");
    if (!box || !field) throw new Error("ue-text-input needs a .textinput box with a .textinput__field input");
    const search = box.classList.contains("textinput--search");
    const sync = () => {
      if (search) box.classList.toggle("textinput--filled", field.value !== "");
    };
    const clear = () => {
      field.value = "";
      sync();
      field.focus();
      this.emit("ue-text-input", { value: "" });
      this.emit("ue-text-clear", {});
    };
    sync();
    this.on(field, "input", () => {
      sync();
      this.emit("ue-text-input", { value: field.value });
    });
    this.on(box, "click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".textinput__clear")) clear();
      else if (event.target !== field && !event.target.closest(".textinput__trail")) field.focus();
    });
    this.on(field, "keydown", (event) => {
      if (!search || event.key !== "Escape" || field.readOnly || field.value === "") return;
      event.preventDefault();
      clear();
    });
  }
>>>>>>> claude/adoring-faraday-94vc0i
};
define("ue-text-input", UeTextInputElement);
export {
  UeTextInputElement
};
