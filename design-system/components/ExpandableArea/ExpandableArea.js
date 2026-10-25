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

// design-system/src/ExpandableArea/ExpandableArea.ts
function headerOf(target) {
  return target instanceof Element ? target.closest('.expandablearea__header[role="button"]') : null;
}
var UeExpandableAreaElement = class extends UeElement {
  setup() {
    for (const header of this.all('.expandablearea__header[role="button"]')) this.#apply(header, header.getAttribute("aria-expanded") === "true");
    this.on(this, "click", (event) => {
      const header = headerOf(event.target);
      if (header) this.#apply(header, header.getAttribute("aria-expanded") !== "true");
    });
    this.on(this, "keydown", (event) => {
      const header = headerOf(event.target);
      if (!header || header !== event.target || event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) this.#apply(header, header.getAttribute("aria-expanded") !== "true");
    });
  }
  #apply(header, expanded) {
    header.setAttribute("aria-expanded", String(expanded));
    const body = header.parentElement?.querySelector(":scope > .expandablearea__body");
    if (body) body.hidden = !expanded;
    this.emit("ue-area-toggle", { expanded });
  }
};
define("ue-expandable-area", UeExpandableAreaElement);
export {
  UeExpandableAreaElement
};
