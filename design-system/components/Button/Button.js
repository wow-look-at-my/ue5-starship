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

// design-system/src/Button/Button.ts
var PRESSED = "button--pressed";
function buttonOf(target) {
  return target instanceof Element ? target.closest(".button") : null;
}
function isDisabled(button) {
  return button.matches(":disabled") || button.getAttribute("aria-disabled") === "true";
}
var UeButtonElement = class extends UeElement {
  #clicks = 0;
  setup() {
    this.on(this, "keydown", (event) => {
      const button = buttonOf(event.target);
      if (!button || isDisabled(button) || event.repeat) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      button.classList.add(PRESSED);
      if (button.tagName !== "BUTTON") {
        event.preventDefault();
        if (event.key === "Enter") button.click();
      }
    });
    this.on(this, "keyup", (event) => {
      const button = buttonOf(event.target);
      if (!button) return;
      const wasPressed = button.classList.contains(PRESSED);
      button.classList.remove(PRESSED);
      if (wasPressed && button.tagName !== "BUTTON" && event.key === " ") button.click();
    });
    this.on(this, "focusout", (event) => {
      const button = buttonOf(event.target);
      if (button) button.classList.remove(PRESSED);
    });
    this.on(this, "click", (event) => {
      const button = buttonOf(event.target);
      if (!button || isDisabled(button)) return;
      this.#clicks++;
      this.dataset.clicks = String(this.#clicks);
      const counter = this.one(".button-count");
      if (counter) counter.textContent = "Clicks: " + this.#clicks + " (last: " + (button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "") + ")";
    });
  }
};
define("ue-button", UeButtonElement);
export {
  UeButtonElement
};
