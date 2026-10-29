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

// design-system/src/TextInput/TextInput.ts
var UeTextInputElement = class extends UeElement {
  setup() {
    const box = this.one(".textinput");
    const field = box?.querySelector(".textinput__field");
    if (!box || !field) throw new Error("ue-text-input needs a .textinput box with a .textinput__field input");
    const search = box.classList.contains("textinput--search");
    const sync = () => {
      if (search) box.classList.toggle("textinput--filled", field.value !== "");
    };
    const clear = () => {
      field.value = "";
      sync();
      field.focus();
      this.emit("ue-text-input", { value: "" });
      this.emit("ue-text-clear", {});
    };
    sync();
    this.on(field, "input", () => {
      sync();
      this.emit("ue-text-input", { value: field.value });
    });
    this.on(box, "click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".textinput__clear")) clear();
      else if (event.target !== field && !event.target.closest(".textinput__trail")) field.focus();
    });
    this.on(field, "keydown", (event) => {
      if (!search || event.key !== "Escape" || field.readOnly || field.value === "") return;
      event.preventDefault();
      clear();
    });
  }
};
define("ue-text-input", UeTextInputElement);

// design-system/src/PlaceActorsPanel/PlaceActorsPanel.ts
var GROUP = ".placeActors-group";
var ROW = ".placeActors-row";
var PlaceActorsPanel = class extends UeElement {
  setup() {
    const field = this.one(".textinput__field");
    const header = this.one(".placeActors-header");
    const empty = this.one(".placeActors-empty");
    const applyFilter = () => {
      const query = (field?.value ?? "").trim().toLowerCase();
      const group = this.one(GROUP + ":not([hidden])");
      let visible = 0;
      if (group) {
        for (const row of Array.from(group.querySelectorAll(ROW))) {
          const name = row.querySelector(".placeActors-name")?.textContent?.toLowerCase() ?? "";
          row.hidden = query !== "" && !name.includes(query);
          if (!row.hidden) visible++;
        }
      }
      if (empty instanceof HTMLElement) empty.hidden = !(query !== "" && visible === 0);
    };
    const show = (name) => {
      if (header) header.textContent = name;
      for (const group of this.all(GROUP)) group.hidden = group.dataset.category !== name;
      applyFilter();
      this.emit("ue-category-change", { category: name });
    };
    this.on(this, "ue-segment-change", (event) => show(event.detail.value));
    this.on(this, "ue-text-input", () => applyFilter());
    this.on(this, "dblclick", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest(".placeActors-info")) return;
      const row = target.closest(ROW);
      if (row) this.emit("ue-place", { name: row.querySelector(".placeActors-name")?.textContent ?? "" });
    });
    this.on(this, "keydown", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches(ROW) && event.key === "Enter") {
        event.preventDefault();
        this.emit("ue-place", { name: target.querySelector(".placeActors-name")?.textContent ?? "" });
      }
    });
    const active = this.one(".SegmentedControl-seg.is-checked");
    if (active) show(active.dataset.value ?? "");
  }
};
define("ue-place-actors-panel", PlaceActorsPanel);
export {
  PlaceActorsPanel
};
