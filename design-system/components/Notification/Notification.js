// design-system/src/_shared/element.ts
var UeElement = class extends HTMLElement {
  #disposers = [];
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

// design-system/src/_shared/own.ts
function ownedBy(host, target) {
  return target instanceof Element && target.closest(host.localName) === host;
}

// design-system/src/Button/Button.ts
var PRESSED = "button--pressed";
function isDisabled(button) {
  return button.matches(":disabled") || button.getAttribute("aria-disabled") === "true";
}
var UeButtonElement = class extends UeElement {
  #clicks = 0;
  setup() {
    const button = this.one(".button");
    if (!button) throw new Error("ue-button needs a .button element");
    this.on(button, "keydown", (event) => {
      if (!ownedBy(this, event.target) || isDisabled(button) || event.repeat) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      button.classList.add(PRESSED);
      if (button.tagName !== "BUTTON") {
        event.preventDefault();
        if (event.key === "Enter") button.click();
      }
    });
    this.on(button, "keyup", (event) => {
      const wasPressed = button.classList.contains(PRESSED);
      button.classList.remove(PRESSED);
      if (wasPressed && button.tagName !== "BUTTON" && event.key === " ") button.click();
    });
    this.on(button, "focusout", () => button.classList.remove(PRESSED));
    this.on(button, "click", () => {
      if (isDisabled(button)) return;
      let pressed = null;
      if (button.hasAttribute("aria-pressed")) {
        pressed = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(pressed));
      }
      this.#clicks++;
      this.emit("ue-button-click", { label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "", pressed, count: this.#clicks });
    });
  }
};
define("ue-button", UeButtonElement);

// design-system/src/Notification/Notification.ts
var UeNotificationElement = class extends UeElement {
  #shown = 0;
  setup() {
    this.on(this, "click", (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest(".button[data-action]");
      if (!button) return;
      switch (button.dataset.action) {
        case "dismiss":
          this.#dismiss(button.closest(".notification-slot"));
          break;
        case "retry":
          this.#retry(button);
          break;
        case "show":
          this.#show();
          break;
        default:
          break;
      }
    });
  }
  #dismiss(slot) {
    if (!slot || slot.classList.contains("notification-slot--closing")) return;
    slot.classList.add("notification-slot--closing");
    void Promise.all(slot.getAnimations().map((animation) => animation.finished.catch(() => void 0))).then(() => {
      slot.remove();
      this.emit("ue-notification-dismiss", {});
    });
  }
  #retry(button) {
    const sub = button.closest(".notification")?.querySelector(".notification__sub");
    if (!sub) return;
    const tries = Number(sub.getAttribute("data-tries") ?? "0") + 1;
    sub.setAttribute("data-tries", String(tries));
    sub.textContent = "Chair.fbx could not be read. Retried " + tries + (tries === 1 ? " time." : " times.");
  }
  #show() {
    const template = this.one(".notification-template");
    const stack = this.one(".notification-stack");
    if (!template || !stack) return;
    const slot = template.content.cloneNode(true);
    this.#shown++;
    if (slot instanceof DocumentFragment) {
      const title = slot.querySelector(".notification__title");
      if (title) title.textContent = "Saved " + this.#shown + (this.#shown === 1 ? " asset" : " assets");
    }
    stack.prepend(slot);
  }
};
define("ue-notification", UeNotificationElement);
export {
  UeNotificationElement
};
