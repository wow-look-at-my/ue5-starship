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

// src/FilterPills/FilterPills.ts
var UeFilterPills = class extends UeElement {
  setup() {
    for (const strip of this.all(".FilterPills-strip")) {
      this.on(strip, "click", (event) => {
        const pill = event.target.closest(".FilterPills-pill");
        if (pill && strip.contains(pill)) this.select(strip, pill, false);
      });
      this.on(strip, "keydown", (event) => {
        const pills = Array.from(strip.querySelectorAll(".FilterPills-pill"));
        const at = pills.indexOf(document.activeElement);
        if (at < 0) return;
        let next = -1;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % pills.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + pills.length) % pills.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = pills.length - 1;
        if (next < 0) return;
        event.preventDefault();
        this.select(strip, pills[next], true);
      });
    }
  }
  select(strip, pill, focus) {
    for (const other of strip.querySelectorAll(".FilterPills-pill")) {
      const on = other === pill;
      other.classList.toggle("is-checked", on);
      other.setAttribute("aria-selected", String(on));
      other.tabIndex = on ? 0 : -1;
    }
    if (focus) pill.focus();
    this.emit("ue-filter-change", { label: pill.textContent ?? "" });
  }
};
define("ue-filter-pills", UeFilterPills);
