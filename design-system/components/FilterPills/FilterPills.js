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

// src/FilterPills/FilterPills.ts
var CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
var UeFilterPills = class extends UeElement {
  #strip = null;
  setup() {
    const strip = this.all(".FilterPills-strip").find((candidate) => this.owns(candidate)) ?? this.#createStrip();
    this.#strip = strip;
    this.on(strip, "click", (event) => {
      if (!this.owns(event.target)) return;
      const target = event.target;
      const remove = target.closest(".FilterPills-chipRemove");
      const chip = remove?.closest(".FilterPills-chip");
      if (chip) {
        this.removeChip(this.#chipId(chip));
        return;
      }
      const pill = target.closest(".FilterPills-pill");
      if (pill && strip.contains(pill)) this.#select(pill, false);
    });
    this.on(strip, "keydown", (event) => {
      if (!this.owns(event.target)) return;
      const pills = this.#pills();
      const at = pills.indexOf(document.activeElement);
      if (at < 0) return;
      let next = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % pills.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + pills.length) % pills.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = pills.length - 1;
      if (next < 0) return;
      event.preventDefault();
      this.#select(pills[next], true);
    });
    if (this.#pills().length > 0 && !strip.hasAttribute("role")) strip.setAttribute("role", "tablist");
    if (strip.classList.contains("FilterPills-strip--chips")) strip.setAttribute("role", "list");
  }
  #createStrip() {
    const strip = document.createElement("div");
    strip.className = "FilterPills-strip";
    this.append(strip);
    return strip;
  }
  #pills() {
    return Array.from(this.#strip?.querySelectorAll(".FilterPills-pill") ?? []);
  }
  #chips() {
    return Array.from(this.#strip?.querySelectorAll(".FilterPills-chip") ?? []);
  }
  #valueOf(pill) {
    return pill.dataset.value ?? (pill.textContent ?? "").trim();
  }
  #chipId(chip) {
    return chip.dataset.id ?? (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim();
  }
  // The value of the checked pill, or an empty string when no pill is checked.
  get value() {
    const checked = this.#pills().find((pill) => pill.classList.contains("is-checked"));
    return checked ? this.#valueOf(checked) : "";
  }
  // Checks the pill with this value. It fires ue-filter-change when that changes the checked pill.
  set value(value) {
    const pill = this.#pills().find((candidate) => this.#valueOf(candidate) === value);
    if (pill) this.#select(pill, false);
  }
  #select(pill, focus) {
    const changed = !pill.classList.contains("is-checked");
    for (const other of this.#pills()) {
      const on = other === pill;
      other.classList.toggle("is-checked", on);
      other.setAttribute("aria-selected", String(on));
      other.tabIndex = on ? 0 : -1;
    }
    if (focus) pill.focus();
    if (changed) this.emit("ue-filter-change", { value: this.#valueOf(pill), label: (pill.textContent ?? "").trim() });
  }
  // Replaces every pill. The first pill with checked set is checked; with none, no pill is checked.
  setPills(pills) {
    const strip = this.#strip;
    if (!strip) return;
    const drawn = pills.map((data) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "FilterPills-pill" + (data.checked ? " is-checked" : "");
      pill.setAttribute("role", "tab");
      pill.setAttribute("aria-selected", String(data.checked === true));
      pill.dataset.value = data.value;
      pill.textContent = data.label;
      return pill;
    });
    strip.replaceChildren(...drawn);
    strip.setAttribute("role", "tablist");
    const stop = drawn.find((pill) => pill.classList.contains("is-checked")) ?? drawn[0];
    for (const pill of drawn) pill.tabIndex = pill === stop ? 0 : -1;
  }
  // The chips in order.
  getChips() {
    return this.#chips().map((chip) => ({ id: this.#chipId(chip), label: (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim(), color: chip.querySelector(".FilterPills-chipColor")?.style.background || void 0 }));
  }
  // Adds a removable chip at the end. An id that is already there is ignored.
  addChip(data) {
    const strip = this.#strip;
    if (!strip || this.#chips().some((chip2) => this.#chipId(chip2) === data.id)) return;
    strip.classList.add("FilterPills-strip--chips");
    strip.setAttribute("role", "list");
    const chip = document.createElement("span");
    chip.className = "FilterPills-chip";
    chip.setAttribute("role", "listitem");
    chip.dataset.id = data.id;
    chip.setAttribute("aria-label", "Filter: " + data.label);
    const color = document.createElement("span");
    color.className = "FilterPills-chipColor";
    if (data.color) color.style.background = data.color;
    const name = document.createElement("span");
    name.className = "FilterPills-chipName";
    name.textContent = data.label;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "FilterPills-chipRemove";
    remove.setAttribute("aria-label", "Remove " + data.label + " filter");
    remove.innerHTML = CROSS;
    chip.append(color, name, remove);
    strip.append(chip);
    strip.hidden = false;
    this.emit("ue-pill-add", { id: data.id, label: data.label, color: data.color });
  }
  // Removes the chip with this id. It fires ue-pill-remove.
  removeChip(id) {
    const chip = this.#chips().find((candidate) => this.#chipId(candidate) === id);
    if (!chip) return;
    const detail = { id, label: (chip.querySelector(".FilterPills-chipName")?.textContent ?? "").trim() };
    chip.remove();
    if (this.#strip && this.#chips().length === 0) this.#strip.hidden = true;
    this.emit("ue-pill-remove", detail);
  }
  // Replaces every chip. It fires ue-pill-add for each new chip and ue-pill-remove for each chip that was dropped.
  setChips(chips) {
    const wanted = new Set(chips.map((chip) => chip.id));
    for (const have of this.getChips()) if (!wanted.has(have.id)) this.removeChip(have.id);
    for (const chip of chips) this.addChip(chip);
  }
};
define("ue-filter-pills", UeFilterPills);
