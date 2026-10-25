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

// design-system/src/Notification/Notification.ts
var UeNotificationElement = class extends UeElement {
  #shown = 0;
  setup() {
    this.on(this, "click", (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest(".notification__btn");
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
