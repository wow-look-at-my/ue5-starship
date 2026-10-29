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

// design-system/src/Tooltip/Tooltip.ts
var SUMMON_DELAY = 150;
var INTRO = 100;
var OFFSET_X = 12;
var OFFSET_Y = 8;
var EDGE = 4;
function targetOf(node) {
  return node instanceof Element ? node.closest(".tooltip-target") : null;
}
var UeTooltipElement = class extends UeElement {
  #active = null;
  #suppressed = null;
  #frame = 0;
  setup() {
    this.on(this, "pointerover", (event) => {
      const target = targetOf(event.target);
      if (!target || target === this.#suppressed || this.#active?.target === target) return;
      this.#summon(target, event.clientX, event.clientY);
    });
    this.on(this, "pointermove", (event) => {
      const target = targetOf(event.target);
      if (target && this.#active?.target === target && this.#active.start >= 0) {
        this.#active.x = event.clientX;
        this.#active.y = event.clientY;
      }
    });
    this.on(this, "pointerout", (event) => {
      const target = targetOf(event.target);
      if (!target) return;
      if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
      if (this.#suppressed === target) this.#suppressed = null;
      if (this.#active?.target === target) this.#dismiss();
    });
    this.on(this, "pointerdown", (event) => {
      const target = targetOf(event.target);
      if (!target) return;
      this.#suppressed = target;
      this.#dismiss();
    });
    this.on(this, "focusin", (event) => {
      const target = targetOf(event.target);
      if (!target || target !== event.target || !target.matches(":focus-visible") || this.#active?.target === target) return;
      const rect = target.getBoundingClientRect();
      this.#summon(target, rect.left, rect.bottom - OFFSET_Y);
    });
    this.on(this, "focusout", (event) => {
      if (this.#active && targetOf(event.target) === this.#active.target) this.#dismiss();
    });
    this.on(document, "keydown", (event) => {
      if (event.key === "Escape") this.#dismiss();
    });
    this.onDispose(() => this.#dismiss());
  }
  #summon(target, x, y) {
    this.#dismiss();
    const popup = target.querySelector(".tooltip-popup");
    if (!popup) return;
    this.#active = { target, popup, start: performance.now(), x, y };
    this.#frame = requestAnimationFrame(this.#tick);
  }
  #dismiss() {
    cancelAnimationFrame(this.#frame);
    if (this.#active) {
      this.#active.popup.hidden = true;
      this.#active.popup.style.opacity = "0";
      this.#active = null;
    }
  }
  #tick = (now) => {
    const active = this.#active;
    if (!active) return;
    const elapsed = now - active.start - SUMMON_DELAY;
    if (elapsed >= 0) {
      const popup = active.popup;
      popup.hidden = false;
      popup.style.opacity = String(Math.min(1, elapsed / INTRO));
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      const left = Math.max(EDGE, Math.min(active.x + OFFSET_X, window.innerWidth - width - EDGE));
      const top = Math.max(EDGE, Math.min(active.y + OFFSET_Y, window.innerHeight - height - EDGE));
      popup.style.left = left + "px";
      popup.style.top = top + "px";
    }
    this.#frame = requestAnimationFrame(this.#tick);
  };
};
define("ue-tooltip", UeTooltipElement);
export {
  UeTooltipElement
};
