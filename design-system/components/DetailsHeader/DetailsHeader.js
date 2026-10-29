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

// src/DetailsHeader/DetailsHeader.ts
var UeDetailsHeader = class extends UeElement {
  setup() {
    const lock = this.one(".DetailsHeader-lock");
    const label = this.one(".DetailsHeader-label");
    if (lock) this.on(lock, "click", () => this.setLocked(lock, lock.getAttribute("aria-pressed") !== "true"));
    if (label) this.wireLabel(label);
  }
  setLocked(lock, locked) {
    lock.setAttribute("aria-pressed", String(locked));
    lock.querySelector("use")?.setAttribute("href", locked ? "#DetailsHeader-locked" : "#DetailsHeader-unlock");
  }
  // Enter commits, Escape restores the text from before the edit. The instance row shows the committed name.
  wireLabel(label) {
    let before = label.textContent ?? "";
    this.on(label, "focus", () => {
      before = label.textContent ?? "";
    });
    this.on(label, "keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        label.blur();
      } else if (event.key === "Escape") {
        label.textContent = before;
        label.blur();
      }
    });
    this.on(label, "blur", () => {
      const text = (label.textContent ?? "").trim();
      label.textContent = text === "" ? before : text;
      for (const name of this.all(".DetailsHeader-instance .name")) name.textContent = label.textContent;
    });
  }
};
define("ue-details-header", UeDetailsHeader);
