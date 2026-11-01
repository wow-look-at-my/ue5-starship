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

// design-system/src/SegmentedControl/SegmentedControl.ts
var UeSegmentedControl = class extends UeElement {
  #group = null;
  setup() {
    const group = this.all(".SegmentedControl").find((candidate) => this.owns(candidate));
    if (!group) throw new Error("ue-segmented-control needs a .SegmentedControl radiogroup");
    this.#group = group;
    group.setAttribute("role", "radiogroup");
    this.on(group, "click", (event) => {
      if (!this.owns(event.target)) return;
      const seg = event.target.closest(".SegmentedControl-seg");
      if (seg && group.contains(seg)) this.#select(seg, false);
    });
    this.on(group, "keydown", (event) => {
      if (!this.owns(event.target)) return;
      const segs = this.#segs();
      const at = segs.indexOf(document.activeElement);
      if (at < 0) return;
      let next = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(at + 1, segs.length - 1);
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(at - 1, 0);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = segs.length - 1;
      if (next < 0) return;
      event.preventDefault();
      this.#select(segs[next], true);
    });
  }
  #segs() {
    return Array.from(this.#group?.querySelectorAll(".SegmentedControl-seg") ?? []);
  }
  // A segment is named by data-value, else aria-label, else its text.
  #valueOf(seg) {
    return seg.dataset.value ?? seg.getAttribute("aria-label") ?? (seg.textContent ?? "").trim();
  }
  #labelOf(seg) {
    return seg.getAttribute("aria-label") ?? (seg.textContent ?? "").trim();
  }
  // The value of the checked segment.
  get value() {
    const checked = this.#segs().find((seg) => seg.classList.contains("is-checked"));
    return checked ? this.#valueOf(checked) : "";
  }
  // Checks the segment with this value. It fires ue-segment-change when that changes the checked segment.
  set value(value) {
    const seg = this.#segs().find((candidate) => this.#valueOf(candidate) === value);
    if (seg) this.#select(seg, false);
  }
  #select(seg, focus) {
    const changed = !seg.classList.contains("is-checked");
    for (const other of this.#segs()) {
      const on = other === seg;
      other.classList.toggle("is-checked", on);
      other.setAttribute("aria-checked", String(on));
      other.tabIndex = on ? 0 : -1;
    }
    if (focus) seg.focus();
    if (changed) this.emit("ue-segment-change", { value: this.#valueOf(seg), label: this.#labelOf(seg) });
  }
};
define("ue-segmented-control", UeSegmentedControl);
