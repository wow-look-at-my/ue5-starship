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

// design-system/src/SegmentedControl/SegmentedControl.ts
var UeSegmentedControl = class extends UeElement {
  setup() {
    for (const group of this.all(".SegmentedControl")) {
      this.on(group, "click", (event) => {
        const seg = event.target.closest(".SegmentedControl-seg");
        if (seg && group.contains(seg)) this.select(group, seg, false);
      });
      this.on(group, "keydown", (event) => {
        const segs = Array.from(group.querySelectorAll(".SegmentedControl-seg"));
        const at = segs.indexOf(document.activeElement);
        if (at < 0) return;
        let next = -1;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(at + 1, segs.length - 1);
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(at - 1, 0);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = segs.length - 1;
        if (next < 0) return;
        event.preventDefault();
        this.select(group, segs[next], true);
      });
    }
  }
  select(group, seg, focus) {
    for (const other of group.querySelectorAll(".SegmentedControl-seg")) {
      const on = other === seg;
      other.classList.toggle("is-checked", on);
      other.setAttribute("aria-checked", String(on));
      other.tabIndex = on ? 0 : -1;
    }
    if (focus) seg.focus();
    this.emit("ue-segment-change", { label: seg.textContent ?? "" });
  }
};
define("ue-segmented-control", UeSegmentedControl);
