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

// src/TextInput/TextInput.ts
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
