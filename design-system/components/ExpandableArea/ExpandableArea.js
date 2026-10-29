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

// src/_shared/own.ts
function ownedBy(host, target) {
  return target instanceof Element && target.closest(host.localName) === host;
}

// src/ExpandableArea/ExpandableArea.ts
var INTERACTIVE = 'button, a[href], input, select, textarea, label, [tabindex], [role="button"], [role="checkbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="menuitem"]';
function isNestedControl(target, header) {
  for (let node = target; node && node !== header; node = node.parentElement) {
    if (node.localName.startsWith("ue-") || node.matches(INTERACTIVE)) return true;
  }
  return false;
}
var UeExpandableAreaElement = class extends UeElement {
  setup() {
    const header = this.one('.expandablearea__header[role="button"]');
    if (!header) throw new Error('ue-expandable-area needs a .expandablearea__header[role="button"]');
    this.#apply(header, header.getAttribute("aria-expanded") === "true", false);
    this.on(header, "click", (event) => {
      if (ownedBy(this, event.target) && !isNestedControl(event.target, header)) this.#apply(header, header.getAttribute("aria-expanded") !== "true", true);
    });
    this.on(header, "keydown", (event) => {
      if (header !== event.target || event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) this.#apply(header, header.getAttribute("aria-expanded") !== "true", true);
    });
  }
  #apply(header, expanded, announce) {
    header.setAttribute("aria-expanded", String(expanded));
    const body = header.parentElement?.querySelector(":scope > .expandablearea__body");
    if (body) body.hidden = !expanded;
    if (announce) this.emit("ue-expand-toggle", { expanded });
  }
};
define("ue-expandable-area", UeExpandableAreaElement);
export {
  UeExpandableAreaElement
};
