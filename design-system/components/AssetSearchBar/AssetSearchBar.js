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

// design-system/src/_shared/popup.ts
function enabledRows(menu, rowSelector) {
  return Array.from(menu.querySelectorAll(rowSelector)).filter((row) => row.getAttribute("aria-disabled") !== "true");
}
function rowLabel(row, labelSelector) {
  const label = row.querySelector(labelSelector);
  return (label ?? row).textContent?.trim() ?? "";
}

// design-system/src/PopupMenu/PopupMenu.ts
var ROW = ".popupmenu__row";
var CURRENT = "popupmenu__row--hover";
var OPEN = "popupmenu__row--open";
var PRESSED2 = "popupmenu__row--pressed";
var KEYS = "popupmenu--keys";
function rowOf(target) {
  return target instanceof Element ? target.closest(ROW) : null;
}
function isDisabled2(row) {
  return row.getAttribute("aria-disabled") === "true";
}
function submenuOf(row) {
  return row.querySelector(":scope > .popupmenu__sub");
}
function menuOf(row) {
  return row.parentElement;
}
var UePopupMenuElement = class extends UeElement {
  // The focusable .popupmenu list.
  get root() {
    const root = this.one(".popupmenu[tabindex]");
    if (!root) throw new Error("ue-popup-menu needs a .popupmenu[tabindex] element");
    return root;
  }
  // Focuses the list and marks `row` current. `keys` hides the hover highlight, as after an arrow key.
  focusMenu(row, keys) {
    const root = this.root;
    root.focus({ preventScroll: true });
    root.classList.toggle(KEYS, keys);
    this.#show(root, row, null);
  }
  // Clears the current row and closes every submenu.
  reset() {
    const root = this.root;
    root.classList.remove(KEYS);
    this.#show(root, null, null);
  }
  // The enabled rows of the top level, in order.
  topRows() {
    return enabledRows(this.root, ":scope > " + ROW);
  }
  setup() {
    void this.root;
    this.on(this, "mousemove", (event) => {
      const row = rowOf(event.target);
      if (!row || !ownedBy(this, event.target)) return;
      const root = this.root;
      root.classList.remove(KEYS);
      if (isDisabled2(row)) return;
      const sub = submenuOf(row);
      const open = sub !== null && !sub.hidden;
      if (row.classList.contains(CURRENT) && (sub === null || open)) return;
      this.#show(root, row, sub ? row : null);
    });
    this.on(this, "pointerdown", (event) => {
      const row = rowOf(event.target);
      if (row && ownedBy(this, event.target) && event.button === 0 && !isDisabled2(row)) row.classList.add(PRESSED2);
    });
    const release = () => {
      for (const row of this.all(ROW + "." + PRESSED2)) row.classList.remove(PRESSED2);
    };
    this.on(this, "pointerup", release);
    this.on(this, "pointercancel", release);
    this.on(this, "pointerout", (event) => {
      const row = rowOf(event.target);
      if (row && !(event.relatedTarget instanceof Node && row.contains(event.relatedTarget))) row.classList.remove(PRESSED2);
    });
    this.on(this, "click", (event) => {
      const row = rowOf(event.target);
      if (!row || !ownedBy(this, event.target) || isDisabled2(row)) return;
      const sub = submenuOf(row);
      if (sub) {
        this.#show(this.root, row, sub.hidden ? row : null);
        return;
      }
      this.#show(this.root, row, null);
      this.#activate(row);
    });
    this.on(this, "mouseout", (event) => {
      const root = this.root;
      if (!ownedBy(this, event.target) || event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
      if (!root.classList.contains(KEYS)) this.#show(root, null, null);
    });
    this.on(this, "keydown", (event) => {
      if (event.target === this.root) this.#key(event, this.root);
    });
    this.on(this, "focusout", (event) => {
      const root = this.root;
      if (!root.contains(event.target)) return;
      if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) this.#show(root, null, null);
    });
  }
  // Marks one row current, opens the submenus on its path, and optionally opens the submenu of `open`.
  #show(root, current, open) {
    const keep = /* @__PURE__ */ new Set();
    for (let row = current; row; row = row.parentElement?.closest(ROW) ?? null) {
      if (row !== current) keep.add(row);
    }
    if (open) keep.add(open);
    for (const row of Array.from(root.querySelectorAll(ROW))) {
      row.classList.toggle(CURRENT, row === current);
      const sub = submenuOf(row);
      if (sub) {
        const isOpen = keep.has(row);
        sub.hidden = !isOpen;
        row.classList.toggle(OPEN, isOpen);
        row.setAttribute("aria-expanded", String(isOpen));
      }
    }
  }
  #activate(row) {
    const role = row.getAttribute("role");
    const label = rowLabel(row, ".popupmenu__label");
    let checked = null;
    let text = label;
    if (role === "menuitemcheckbox") {
      checked = row.getAttribute("aria-checked") !== "true";
      row.setAttribute("aria-checked", String(checked));
      text += checked ? " (checked)" : " (unchecked)";
    } else if (role === "menuitemradio") {
      for (const other of Array.from(menuOf(row)?.querySelectorAll(':scope > [role="menuitemradio"]') ?? [])) {
        other.setAttribute("aria-checked", String(other === row));
      }
      checked = true;
      text += " (selected)";
    }
    const detail = { label, role, checked, text, value: row.dataset.value ?? label, row };
    this.emit("ue-menu-activate", detail);
  }
  #key(event, root) {
    const current = root.querySelector(ROW + "." + CURRENT);
    const menu = current ? menuOf(current) : root;
    if (!menu) return;
    const rows = enabledRows(menu, ":scope > " + ROW);
    const index = current ? rows.indexOf(current) : -1;
    const go = (next) => {
      root.classList.add(KEYS);
      if (next) this.#show(root, next, null);
    };
    switch (event.key) {
      case "ArrowDown":
        go(rows[index < 0 ? 0 : (index + 1) % rows.length]);
        break;
      case "ArrowUp":
        go(rows[index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length]);
        break;
      case "Home":
        go(rows[0]);
        break;
      case "End":
        go(rows[rows.length - 1]);
        break;
      case "ArrowRight":
        this.#enter(root, current);
        break;
      case "ArrowLeft":
        this.#leave(root, current);
        break;
      case "Escape":
        root.classList.add(KEYS);
        if (current && menu !== root) {
          this.#leave(root, current);
          event.stopPropagation();
        } else {
          this.#show(root, null, null);
        }
        break;
      case "Enter":
      case " ":
        root.classList.add(KEYS);
        if (event.repeat || !current) break;
        if (submenuOf(current)) this.#enter(root, current);
        else this.#activate(current);
        break;
      default:
        return;
    }
    event.preventDefault();
  }
  // Opens the submenu of the current row and moves to its first enabled row.
  #enter(root, current) {
    root.classList.add(KEYS);
    const sub = current ? submenuOf(current) : null;
    if (!current || !sub) return;
    const first = enabledRows(sub, ":scope > " + ROW)[0];
    this.#show(root, first ?? current, current);
  }
  // Closes the submenu that holds the current row and returns to its parent row.
  #leave(root, current) {
    root.classList.add(KEYS);
    const parent = current ? menuOf(current)?.closest(ROW) ?? null : null;
    if (parent) this.#show(root, parent, null);
  }
};
define("ue-popup-menu", UePopupMenuElement);

// design-system/src/ComboButton/ComboButton.ts
var OPEN2 = "combobutton--open";
var ACTIVATE_KEYS = ["Enter", " ", "ArrowDown", "ArrowUp"];
var UeComboButtonElement = class extends UeElement {
  #trigger;
  #panel;
  setup() {
    const trigger = this.one(".combobutton");
    const panel = this.one(".combobutton-menu");
    if (!trigger || !panel) throw new Error("ue-combo-button needs a .combobutton trigger and a .combobutton-menu panel");
    if (!panel.querySelector("ue-popup-menu")) throw new Error("the .combobutton-menu panel needs a ue-popup-menu");
    this.#trigger = trigger;
    this.#panel = panel;
    const anchor = trigger.closest(".combobutton-anchor") ?? this;
    if (!this.#isAction()) this.#markSelected(this.#labelText());
    this.on(trigger, "click", () => {
      if (this.#disabled()) return;
      if (panel.hidden) this.#open(false, false);
      else this.#close(false);
    });
    this.on(trigger, "keydown", (event) => {
      if (event.target !== trigger || this.#disabled() || !ACTIVATE_KEYS.includes(event.key)) return;
      event.preventDefault();
      if (panel.hidden && !event.repeat) this.#open(true, event.key === "ArrowUp");
    });
    this.on(panel, "mousedown", (event) => event.preventDefault());
    this.on(panel, "keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.#close(true);
      } else if (event.key === "Tab") {
        this.#close(false);
      }
    });
    this.on(this, "ue-menu-activate", (event) => {
      if (ownedBy(this, event.target)) this.#pick(event.detail);
    });
    this.on(document, "pointerdown", (event) => {
      if (!panel.hidden && !(event.target instanceof Node && anchor.contains(event.target))) this.#close(false);
    });
  }
  // True while the panel shows.
  get isOpen() {
    return !this.#panel.hidden;
  }
  // Opens the panel. `keys` moves the focus into the list, `fromEnd` starts at the last row.
  open(keys = false, fromEnd = false) {
    if (this.#disabled() || this.isOpen) return;
    this.#open(keys, fromEnd);
  }
  // Closes the panel. `refocus` returns the focus to the trigger.
  close(refocus = false) {
    if (this.isOpen) this.#close(refocus);
  }
  #disabled() {
    return this.#trigger.getAttribute("aria-disabled") === "true";
  }
  // Action mode keeps the label fixed. Value mode shows the picked row. mode="value" gives a simple trigger value mode.
  #isAction() {
    const mode = this.getAttribute("mode");
    if (mode === "action" || this.#label() === null) return true;
    return mode !== "value" && this.#trigger.classList.contains("combobutton--simple");
  }
  #label() {
    return this.#trigger.querySelector(".combobutton__label");
  }
  #labelText() {
    return this.#label()?.textContent?.trim() ?? "";
  }
  // The popup menu is upgraded by its own module, which can load after this.
  #popup() {
    const popup = this.#panel.querySelector("ue-popup-menu");
    if (!popup || typeof popup.focusMenu !== "function") throw new Error("ue-popup-menu is not defined");
    return popup;
  }
  #rows() {
    return Array.from(this.#panel.querySelectorAll(".popupmenu[tabindex] > .popupmenu__row")).filter((row) => row.getAttribute("aria-disabled") !== "true");
  }
  #markSelected(label) {
    for (const row of this.#rows()) row.setAttribute("aria-selected", String(rowLabel(row, ".popupmenu__label") === label));
  }
  #open(keys, fromEnd) {
    const popup = this.#popup();
    this.#panel.hidden = false;
    this.#trigger.classList.add(OPEN2);
    this.#trigger.setAttribute("aria-expanded", "true");
    const rows = this.#rows();
    const selected = rows.find((row) => row.getAttribute("aria-selected") === "true" || row.getAttribute("aria-checked") === "true");
    popup.focusMenu(keys ? selected ?? (fromEnd ? rows[rows.length - 1] : rows[0]) ?? null : null, keys);
  }
  #close(refocus) {
    this.#panel.hidden = true;
    this.#trigger.classList.remove(OPEN2);
    this.#trigger.setAttribute("aria-expanded", "false");
    this.#popup().reset();
    if (refocus) this.#trigger.focus();
  }
  #pick(detail) {
    const label = this.#label();
    if (!this.#isAction() && label && detail.role !== "menuitemcheckbox") {
      label.textContent = detail.label;
      this.#markSelected(detail.label);
    }
    this.#close(true);
    this.emit("ue-combo-pick", { value: detail.value, label: detail.label, checked: detail.checked });
  }
};
define("ue-combo-button", UeComboButtonElement);

// design-system/src/FilterPills/FilterPills.ts
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

// design-system/src/AssetSearchBar/AssetSearchBar.ts
var FILTERS = {
  "Static Mesh": "var(--accent-blue)",
  Material: "var(--accent-green)",
  Texture: "var(--accent-orange)",
  Blueprint: "var(--accent-purple)",
  Level: "var(--accent-pink)"
};
var AssetSearchBarElement = class extends UeElement {
  #input;
  #chips;
  setup() {
    const input = this.one(".textinput__field");
    const chips = this.one("ue-filter-pills");
    if (!input || !chips) throw new Error("ue-asset-search-bar needs a .textinput__field input and a ue-filter-pills");
    this.#input = input;
    this.#chips = chips;
    this.#syncPlus();
    this.on(this, "ue-text-input", (event) => {
      if (!this.#mine(event)) return;
      this.#syncPlus();
      this.#announce();
    });
    this.on(this, "ue-button-click", (event) => {
      if (this.#mine(event) && event.target.dataset.action === "save") this.emit("assetsearchbar:save", { text: this.#input.value });
    });
    this.on(this, "ue-combo-pick", (event) => {
      if (!this.#mine(event)) return;
      const { label, checked } = event.detail;
      if (checked) this.#chips.addChip({ id: label, label, color: FILTERS[label] });
      else this.#chips.removeChip(label);
    });
    this.on(this, "ue-pill-add", (event) => {
      if (this.#mine(event)) this.#announce();
    });
    this.on(this, "ue-pill-remove", (event) => {
      if (!this.#mine(event)) return;
      this.#uncheck(event.detail.id);
      this.#announce();
    });
  }
  get text() {
    return this.#input.value;
  }
  // Sets the hint of the field.
  setPlaceholder(text) {
    this.#input.placeholder = text;
  }
  // Sets the text of the field as typing would, so the clear X and the change event follow.
  setText(text) {
    if (this.#input.value === text) return;
    this.#input.value = text;
    this.#input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  #mine(event) {
    return this.owns(event.target);
  }
  // The save-search plus shows only while the field has text.
  #syncPlus() {
    for (const plus of this.all(".AssetSearchBar__plus")) plus.hidden = this.#input.value === "";
  }
  // A chip that went away leaves its menu row unchecked.
  #uncheck(id) {
    for (const row of this.all('.popupmenu__row[role="menuitemcheckbox"]')) if (row.dataset.value === id) row.setAttribute("aria-checked", "false");
  }
  #announce() {
    this.emit("assetsearchbar:change", { text: this.#input.value, filters: this.#chips.getChips().map((chip) => chip.id) });
  }
};
define("ue-asset-search-bar", AssetSearchBarElement);
export {
  AssetSearchBarElement
};
