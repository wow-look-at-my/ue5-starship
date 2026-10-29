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

// design-system/src/_shared/tileGrid.ts
function nearestInRow(tiles, from, down) {
  const tops = new Map(tiles.map((tile) => [tile, tile.getBoundingClientRect()]));
  const box = from.getBoundingClientRect();
  const rows = tiles.filter((tile) => {
    const top = tops.get(tile)?.top ?? box.top;
    return down ? top > box.top + 1 : top < box.top - 1;
  });
  if (rows.length === 0) return void 0;
  const edgeTops = rows.map((tile) => tops.get(tile)?.top ?? 0);
  const edge = down ? Math.min(...edgeTops) : Math.max(...edgeTops);
  const centre = box.left + box.width / 2;
  const distance = (tile) => {
    const rect = tops.get(tile);
    return rect ? Math.abs(rect.left + rect.width / 2 - centre) : Infinity;
  };
  const line = rows.filter((tile) => tops.get(tile)?.top === edge);
  return line.reduce((best, tile) => distance(tile) < distance(best) ? tile : best);
}

// design-system/src/AssetTile/AssetTile.ts
var SELECTED = "is-selected";
var FOLDER = '<svg class="AssetTile__folderIcon" viewBox="0 0 64 64" aria-hidden="true"><path d="M2 13a2 2 0 0 1 2-2h18l5 6h33a2 2 0 0 1 2 2v31a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="currentColor"/><path d="M2 13a2 2 0 0 1 2-2h18l5 6H2z" fill="#fff" opacity=".12"/><path d="M2 24h60v26a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#000" opacity=".12"/></svg>';
var CUBE = '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M16 3l11 6v14l-11 6-11-6V9z"/><path d="M5 9l11 6 11-6M16 15v14"/></g></svg>';
var AssetTileElement = class extends UeElement {
  #anchor = null;
  #grid = null;
  #lastIds = "";
  setup() {
    this.#anchor = null;
    const grid = this.all(".AssetTile-grid").find((candidate) => this.owns(candidate)) ?? this.#createGrid();
    this.#grid = grid;
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-multiselectable", String(!this.#single()));
    for (const tile of this.#tiles()) {
      tile.setAttribute("role", "option");
      tile.setAttribute("aria-selected", String(tile.classList.contains(SELECTED)));
    }
    this.#rove(null);
    this.#lastIds = this.getSelectedIds().join("\n");
    this.on(this, "click", (event) => {
      if (this.owns(event.target)) this.#click(event);
    });
    this.on(this, "dblclick", (event) => {
      if (this.owns(event.target)) this.#open(this.#tileAt(event.target));
    });
    this.on(this, "keydown", (event) => {
      if (this.owns(event.target)) this.#keydown(event);
    });
  }
  #createGrid() {
    const grid = document.createElement("div");
    grid.className = "AssetTile-grid";
    this.append(grid);
    return grid;
  }
  // select="single" makes every click and key pick one tile. The default is multiple selection.
  #single() {
    return this.getAttribute("select") === "single";
  }
  #tiles() {
    return Array.from(this.#grid?.children ?? []).filter((child2) => child2 instanceof HTMLElement && child2.classList.contains("AssetTile"));
  }
  #tileAt(target) {
    const tile = target instanceof Element ? target.closest(".AssetTile") : null;
    return tile && this.#tiles().includes(tile) ? tile : null;
  }
  #name(tile) {
    return (tile.querySelector(".AssetTile__name")?.textContent ?? "").trim();
  }
  #idOf(tile) {
    return tile.dataset.id ?? this.#name(tile);
  }
  // Ids of the selected tiles in grid order.
  getSelectedIds() {
    return this.#tiles().filter((tile) => tile.classList.contains(SELECTED)).map((tile) => this.#idOf(tile));
  }
  // Selects exactly these tiles. Ids that name no tile are ignored. A single-select grid keeps the first.
  select(ids) {
    const wanted = new Set(this.#single() ? ids.slice(0, 1) : ids);
    const tiles = this.#tiles();
    for (const tile of tiles) this.#mark(tile, wanted.has(this.#idOf(tile)));
    this.#anchor = tiles.find((tile) => tile.classList.contains(SELECTED)) ?? null;
    this.#rove(this.#anchor);
    this.#announce();
  }
  // Replaces every tile with tiles drawn from data.
  setTiles(tiles) {
    const grid = this.#grid;
    if (!grid) return;
    grid.replaceChildren(...tiles.map((data) => this.#draw(data)));
    this.#anchor = null;
    this.#rove(null);
    this.#lastIds = this.getSelectedIds().join("\n");
  }
  #draw(data) {
    const tile = document.createElement("div");
    const folder = data.kind === "folder";
    tile.className = "AssetTile " + (folder ? "AssetTile--folder" : "AssetTile--asset") + (data.selected ? " " + SELECTED : "");
    tile.dataset.id = data.id;
    tile.setAttribute("role", "option");
    tile.setAttribute("aria-selected", String(data.selected === true));
    const thumb = folder ? FOLDER : '<div class="AssetTile__asset"><span class="AssetTile__glyph"></span><span class="AssetTile__strip"></span></div>';
    tile.innerHTML = '<div class="AssetTile__card"><div class="AssetTile__thumb">' + thumb + '</div><div class="AssetTile__nameArea"><div class="AssetTile__name"></div>' + (folder ? "" : '<div class="AssetTile__class"></div>') + "</div></div>";
    const name = tile.querySelector(".AssetTile__name");
    if (name) name.textContent = data.label;
    if (!folder) {
      const holder = tile.querySelector(".AssetTile__glyph");
      if (holder && data.thumb) {
        const image = document.createElement("img");
        image.className = "AssetTile__image";
        image.src = data.thumb;
        image.alt = "";
        holder.replaceWith(image);
      } else {
        holder?.insertAdjacentHTML("afterend", CUBE);
        holder?.remove();
      }
      const kind = tile.querySelector(".AssetTile__class");
      if (kind) kind.textContent = data.typeLabel ?? "";
      if (data.strip) tile.querySelector(".AssetTile__strip")?.style.setProperty("--strip", data.strip);
    }
    return tile;
  }
  // One tile takes the Tab stop: `stop`, else the first selected tile, else the first tile.
  #rove(stop) {
    const tiles = this.#tiles();
    const chosen = stop ?? tiles.find((tile) => tile.classList.contains(SELECTED)) ?? tiles[0];
    for (const tile of tiles) tile.tabIndex = tile === chosen ? 0 : -1;
  }
  // Announces the selection when it differs from the last one announced.
  #announce() {
    const ids = this.getSelectedIds();
    const key = ids.join("\n");
    if (key === this.#lastIds) return;
    this.#lastIds = key;
    this.emit("ue-tile-select", { ids });
  }
  #mark(tile, selected) {
    tile.classList.toggle(SELECTED, selected);
    tile.setAttribute("aria-selected", String(selected));
  }
  // Applies a click or key movement to the selection of the tile's group.
  #choose(tile, wantToggle, wantRange) {
    const toggle = wantToggle && !this.#single();
    const range = wantRange && !this.#single();
    const tiles = this.#tiles();
    if (range && this.#anchor && tiles.includes(this.#anchor)) {
      const from = tiles.indexOf(this.#anchor);
      const to = tiles.indexOf(tile);
      tiles.forEach((each, i) => this.#mark(each, i >= Math.min(from, to) && i <= Math.max(from, to)));
    } else if (toggle) {
      this.#mark(tile, !tile.classList.contains(SELECTED));
      this.#anchor = tile;
    } else {
      for (const each of tiles) this.#mark(each, each === tile);
      this.#anchor = tile;
    }
    this.#rove(tile);
    this.#announce();
  }
  #click(event) {
    const tile = this.#tileAt(event.target);
    if (!tile) return;
    this.#choose(tile, event.ctrlKey || event.metaKey, event.shiftKey);
    tile.focus();
  }
  #open(tile) {
    if (!tile) return;
    this.emit("ue-tile-open", { id: this.#idOf(tile) });
  }
  #keydown(event) {
    const tile = event.target instanceof HTMLElement && event.target.matches(".AssetTile") ? this.#tileAt(event.target) : null;
    if (!tile) return;
    const tiles = this.#tiles();
    const at = tiles.indexOf(tile);
    let go;
    switch (event.key) {
      case "ArrowRight":
        go = tiles[at + 1];
        break;
      case "ArrowLeft":
        go = tiles[at - 1];
        break;
      case "ArrowDown":
        go = nearestInRow(tiles, tile, true);
        break;
      case "ArrowUp":
        go = nearestInRow(tiles, tile, false);
        break;
      case "Home":
        go = tiles[0];
        break;
      case "End":
        go = tiles[tiles.length - 1];
        break;
      case "Enter":
        event.preventDefault();
        this.#open(tile);
        return;
      case " ":
        event.preventDefault();
        this.#choose(tile, event.ctrlKey || event.metaKey, event.shiftKey);
        return;
      case "a":
      case "A":
        if (!(event.ctrlKey || event.metaKey) || this.#single()) return;
        event.preventDefault();
        for (const each of tiles) this.#mark(each, true);
        this.#announce();
        return;
      default:
        return;
    }
    event.preventDefault();
    if (!go) return;
    if ((event.ctrlKey || event.metaKey) && !this.#single()) {
      this.#rove(go);
    } else {
      this.#choose(go, false, event.shiftKey);
    }
    go.focus();
  }
};
define("ue-asset-tile", AssetTileElement);

// design-system/src/ContentToolbar/ContentToolbar.ts
var CHEVRON = '<svg class="combobutton__icon" viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5"/></svg>';
var CHILDREN = {
  All: ["Content", "Plugins"],
  Content: ["StarterContent", "Developers"],
  StarterContent: ["Architecture", "Audio", "Blueprints", "HDRI", "Maps", "Materials", "Particles", "Props", "Shapes", "Textures"]
};
var FALLBACK_CHILDREN = ["Architecture", "Audio", "Blueprints"];
var escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
function crumbHtml(name, index, children) {
  const rows = children.map((child2) => '<div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">' + escape(child2) + "</span></span></div>").join("");
  return '<ue-button data-crumb="' + index + '"><button type="button" class="button button--simple button--tight">' + escape(name) + '</button></ue-button><ue-combo-button mode="action" data-crumb-menu="' + index + '"><div class="combobutton-anchor"><span class="combobutton combobutton--icon" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" aria-label="Sub-folders of ' + escape(name) + '">' + CHEVRON + '</span><div class="combobutton-menu" hidden><ue-popup-menu><div class="popupmenu" role="menu" tabindex="0">' + rows + "</div></ue-popup-menu></div></div></ue-combo-button>";
}
var ContentToolbarElement = class extends UeElement {
  // Names of the folders inside the folder at `path`. The chevron after a crumb lists them.
  childrenOf = (path) => CHILDREN[path[path.length - 1]] ?? FALLBACK_CHILDREN;
  #crumbs;
  #path = [];
  #history = [];
  #index = 0;
  get path() {
    return this.#path;
  }
  setup() {
    const crumbs = this.one(".ContentToolbar__crumbs");
    if (!crumbs) throw new Error("ue-content-toolbar needs a .ContentToolbar__crumbs element");
    this.#crumbs = crumbs;
    this.#path = this.all("ue-button[data-crumb]").filter((host) => this.owns(host)).map((host) => (host.textContent ?? "").trim());
    this.#history = [this.#path];
    this.#index = 0;
    this.#render();
    this.on(this, "ue-button-click", (event) => {
      if (!this.owns(event.target)) return;
      const host = event.target.closest("ue-button");
      if (host?.dataset.action === "back") this.#walk(-1);
      else if (host?.dataset.action === "forward") this.#walk(1);
      else if (host?.dataset.crumb !== void 0) this.#go(this.#path.slice(0, Number(host.dataset.crumb) + 1));
    });
    this.on(this, "ue-combo-pick", (event) => {
      if (!this.owns(event.target)) return;
      const host = event.target.closest("ue-combo-button");
      if (host?.dataset.crumbMenu === void 0) return;
      this.#go(this.#path.slice(0, Number(host.dataset.crumbMenu) + 1).concat(event.detail.label));
    });
  }
  // Replaces the history. `index` is the entry that is current. The path follows it. No event fires.
  setHistory(entries, index) {
    this.#history = entries.map((entry) => entry.slice());
    this.#index = index;
    this.#path = this.#history[index].slice();
    this.#render();
  }
  // Moves to `path` and records it in the history, as a navigation by another part of the page does. No event fires.
  navigate(path) {
    this.#record(path);
    this.#render();
  }
  #record(path) {
    this.#history = this.#history.slice(0, this.#index + 1);
    this.#history.push(path.slice());
    this.#index = this.#history.length - 1;
    this.#path = path.slice();
  }
  #go(path) {
    this.#record(path);
    this.#render();
    this.emit("contenttoolbar:navigate", { path: path.slice() });
  }
  #walk(delta) {
    const next = this.#index + delta;
    if (next < 0 || next >= this.#history.length) return;
    const hadFocus = this.#navButton(delta < 0 ? "back" : "forward") === document.activeElement;
    this.#index = next;
    this.#path = this.#history[next].slice();
    this.#render();
    if (hadFocus) {
      const own = this.#navButton(delta < 0 ? "back" : "forward");
      (own && !own.disabled ? own : this.#navButton(delta < 0 ? "forward" : "back"))?.focus();
    }
    this.emit("contenttoolbar:navigate", { path: this.#path.slice() });
  }
  #navButton(action) {
    return this.one('ue-button[data-action="' + action + '"] .button');
  }
  #render() {
    this.#crumbs.innerHTML = this.#path.map((name, index) => crumbHtml(name, index, this.childrenOf(this.#path.slice(0, index + 1)))).join("");
    const back = this.#navButton("back");
    const forward = this.#navButton("forward");
    if (back) back.disabled = this.#index === 0;
    if (forward) forward.disabled = this.#index >= this.#history.length - 1;
  }
};
define("ue-content-toolbar", ContentToolbarElement);

// design-system/src/ExpandableArea/ExpandableArea.ts
var INTERACTIVE = 'button, a[href], input, select, textarea, label, [tabindex], [role="button"], [role="checkbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="menuitem"]';
function isNestedControl(target, header) {
  for (let node = target; node && node !== header; node = node.parentElement) {
    if (node.localName.startsWith("ue-") || node.matches(INTERACTIVE)) return true;
  }
  return false;
}
var UeExpandableAreaElement = class extends UeElement {
  setup() {
    const header = this.one('.expandablearea__header[role="button"]');
    if (!header) throw new Error('ue-expandable-area needs a .expandablearea__header[role="button"]');
    this.#apply(header, header.getAttribute("aria-expanded") === "true", false);
    this.on(header, "click", (event) => {
      if (ownedBy(this, event.target) && !isNestedControl(event.target, header)) this.#apply(header, header.getAttribute("aria-expanded") !== "true", true);
    });
    this.on(header, "keydown", (event) => {
      if (header !== event.target || event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (!event.repeat) this.#apply(header, header.getAttribute("aria-expanded") !== "true", true);
    });
  }
  #apply(header, expanded, announce) {
    header.setAttribute("aria-expanded", String(expanded));
    const body = header.parentElement?.querySelector(":scope > .expandablearea__body");
    if (body) body.hidden = !expanded;
    if (announce) this.emit("ue-expand-toggle", { expanded });
  }
};
define("ue-expandable-area", UeExpandableAreaElement);

// design-system/src/_shared/tree-controller.ts
var TreeController = class {
  root;
  parts;
  hooks;
  #anchor = null;
  constructor(root, parts, hooks = {}) {
    this.root = root;
    this.parts = parts;
    this.hooks = hooks;
  }
  rows() {
    return Array.from(this.root.querySelectorAll(this.parts.row));
  }
  shown() {
    return this.rows().filter((row) => !row.hidden);
  }
  selected() {
    return this.rows().filter((row) => this.isSelected(row));
  }
  level(row) {
    return parseInt(row.getAttribute("aria-level") ?? "1", 10) || 1;
  }
  isSelected(row) {
    return row.classList.contains("is-selected");
  }
  isOpen(row) {
    return row.getAttribute("aria-expanded") === "true";
  }
  hasChildren(row) {
    if (this.hooks.lazy?.(row)) return true;
    const next = row.nextElementSibling;
    return next instanceof HTMLElement && next.matches(this.parts.row) && this.level(next) > this.level(row);
  }
  // Redraws every derived state from facts per row: aria-level, aria-expanded and the is-selected class.
  refresh() {
    const rows = this.rows();
    const parents = /* @__PURE__ */ new Set();
    rows.forEach((row, index) => {
      if (!this.isSelected(row)) return;
      let want = this.level(row);
      for (let j = index - 1; j >= 0 && want > 1; j--) {
        if (this.level(rows[j]) < want) {
          parents.add(rows[j]);
          want = this.level(rows[j]);
        }
      }
    });
    const shown = [];
    let hideBelow = Infinity;
    rows.forEach((row, index) => {
      const level = this.level(row);
      if (level > hideBelow) {
        row.hidden = true;
        return;
      }
      hideBelow = Infinity;
      const kids = index + 1 < rows.length && this.level(rows[index + 1]) > level || (this.hooks.lazy?.(row) ?? false);
      const stored = kids && this.isOpen(row);
      const open = stored || kids && (this.hooks.forceOpen?.(row) ?? false);
      const arrow = row.querySelector(this.parts.arrow);
      arrow?.classList.toggle("is-leaf", !kids);
      if (kids) {
        row.setAttribute("aria-expanded", stored ? "true" : "false");
        this.#swap(arrow, open ? this.parts.caretOpen : this.parts.caretClosed);
        if (!open) hideBelow = level;
      } else {
        row.removeAttribute("aria-expanded");
      }
      if (this.parts.openClass) row.classList.toggle(this.parts.openClass, open);
      this.#swap(row.querySelector(this.parts.folder), open ? this.parts.folderOpen : this.parts.folderClosed);
      row.setAttribute("aria-selected", this.isSelected(row) ? "true" : "false");
      if (this.hooks.excluded?.(row)) {
        row.hidden = true;
        return;
      }
      row.hidden = false;
      row.classList.toggle("is-odd", shown.length % 2 === 1);
      row.classList.toggle("is-parent", parents.has(row) && !this.isSelected(row));
      shown.push(row);
    });
    const current = shown.find((row) => row.tabIndex === 0) ?? shown.find((row) => this.isSelected(row)) ?? shown[0];
    for (const row of rows) row.tabIndex = row === current ? 0 : -1;
    this.hooks.changed?.();
  }
  setSelection(list, anchor) {
    const set = new Set(list);
    for (const row of this.rows()) row.classList.toggle("is-selected", set.has(row));
    if (anchor) this.#anchor = anchor;
    this.refresh();
    this.hooks.selected?.(this.selected());
  }
  setOpen(row, open) {
    const was = this.isOpen(row);
    row.setAttribute("aria-expanded", open ? "true" : "false");
    this.refresh();
    if (was !== open) this.hooks.toggled?.(row, open);
  }
  focusRow(row, reveal) {
    for (const other of this.rows()) other.tabIndex = other === row ? 0 : -1;
    row.focus({ preventScroll: true });
    if (reveal) row.scrollIntoView({ block: "nearest" });
  }
  // Plain: replace the selection. Shift: range from the anchor. Ctrl or cmd: toggle the row.
  pick(row, given, reveal) {
    const mods = this.hooks.multi === false ? { shiftKey: false, ctrlKey: false, metaKey: false } : given;
    const chosen = this.selected();
    const toggle = mods.ctrlKey || mods.metaKey;
    if (mods.shiftKey) {
      const list = this.shown();
      const from = list.indexOf(this.#anchor ?? row);
      const to = list.indexOf(row);
      const a = from < 0 ? to : from;
      const span = list.slice(Math.min(a, to), Math.max(a, to) + 1);
      this.setSelection(toggle ? chosen.concat(span) : span, null);
    } else if (toggle) {
      this.setSelection(this.isSelected(row) ? chosen.filter((r) => r !== row) : chosen.concat(row), row);
    } else {
      this.setSelection([row], row);
    }
    this.focusRow(row, reveal);
  }
  rowOf(target) {
    if (!(target instanceof Element)) return null;
    const row = target.closest(this.parts.row);
    return row && this.root.contains(row) ? row : null;
  }
  // Returns true when the click was on a row.
  click(event) {
    const row = this.rowOf(event.target);
    if (!row) return false;
    const arrow = event.target.closest(this.parts.arrow);
    if (arrow && !arrow.classList.contains("is-leaf")) {
      this.setOpen(row, !this.isOpen(row));
      this.focusRow(row, false);
      return true;
    }
    this.pick(row, event, false);
    return true;
  }
  doubleClick(event) {
    const row = this.rowOf(event.target);
    if (!row || event.target.closest(this.parts.arrow) || !this.hasChildren(row)) return;
    this.setOpen(row, !this.isOpen(row));
  }
  // Returns true when the key was handled.
  keyDown(event) {
    const row = this.rowOf(event.target);
    if (!row || event.altKey) return false;
    const list = this.shown();
    const i = list.indexOf(row);
    const kids = this.hasChildren(row);
    let target = null;
    switch (event.key) {
      case "ArrowDown":
        target = list[Math.min(i + 1, list.length - 1)];
        break;
      case "ArrowUp":
        target = list[Math.max(i - 1, 0)];
        break;
      case "Home":
        target = list[0];
        break;
      case "End":
        target = list[list.length - 1];
        break;
      case "ArrowLeft":
        if (kids && this.isOpen(row)) {
          this.setOpen(row, false);
        } else {
          for (let j = i - 1; j >= 0; j--) {
            if (this.level(list[j]) < this.level(row)) {
              target = list[j];
              break;
            }
          }
        }
        break;
      case "ArrowRight":
        if (kids && !this.isOpen(row)) this.setOpen(row, true);
        else if (kids) target = list[i + 1];
        break;
      case " ":
      case "Enter":
        this.pick(row, event, true);
        break;
      default:
        return false;
    }
    event.preventDefault();
    if (target) this.pick(target, { shiftKey: event.shiftKey, ctrlKey: false, metaKey: false }, true);
    return true;
  }
  #swap(svg, symbol) {
    const use = svg?.querySelector("use");
    if (use) use.setAttribute("href", "#" + symbol);
  }
};

// design-system/src/TreeRow/TreeRow.ts
var ARROW = '<svg class="tr-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4.5 4L6 12z"/></svg>';
var FOLDER2 = '<svg class="tr-icon is-folder" viewBox="0 0 16 16" aria-hidden="true"><path class="tr-folder-closed" d="M1.5 4.5V12a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.8 3.5H2.5a1 1 0 0 0-1 1z"/><path class="tr-folder-open" d="M1.5 4.5V12a1 1 0 0 0 1 1h10.6l1.9-5.2a.8.8 0 0 0-.75-1.1H5.2L3.8 11V4.5a1 1 0 0 1 1-1h2L8 5h5.5"/></svg>';
var OBJECT = '<svg class="tr-icon is-object" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l5.5 3.1v6.2L8 14.2 2.5 11.1V4.9zM2.5 4.9L8 8l5.5-3.1M8 8v6.2"/></svg>';
var TreeRow = class extends UeElement {
  #tree = null;
  #controller = null;
  #filter = null;
  #kept = /* @__PURE__ */ new Set();
  #parentsOfKept = /* @__PURE__ */ new Set();
  #lastIds = "";
  setup() {
    const tree = this.#ownTree() ?? this.#createTree();
    this.#tree = tree;
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-multiselectable", String(!this.#single()));
    const controller = new TreeController(
      tree,
      {
        row: ".tr-row",
        arrow: ".tr-arrow",
        folder: ".tr-icon.is-folder",
        caretOpen: "",
        caretClosed: "",
        folderOpen: "",
        folderClosed: "",
        openClass: "is-open"
      },
      {
        multi: !this.#single(),
        excluded: (row) => this.#filter !== null && !this.#kept.has(row),
        forceOpen: (row) => this.#filter !== null && this.#parentsOfKept.has(row),
        lazy: (row) => row.dataset.expandable === "true",
        toggled: (row, open) => {
          this.emit("ue-tree-toggle", { id: this.#idOf(row), expanded: open });
          if (!open && this.hasAttribute("collapse-selects") && this.#rows().some((each) => each.hidden && this.#controller?.isSelected(each))) this.select([this.#idOf(row)]);
        },
        selected: () => this.#announceSelection()
      }
    );
    this.#controller = controller;
    this.on(tree, "click", (event) => {
      if (this.owns(event.target)) controller.click(event);
    });
    this.on(tree, "dblclick", (event) => {
      if (this.owns(event.target)) controller.doubleClick(event);
    });
    this.on(tree, "keydown", (event) => {
      if (this.owns(event.target)) controller.keyDown(event);
    });
    this.#lastIds = this.getSelectedIds().join("\n");
    controller.refresh();
  }
  #single() {
    return this.getAttribute("select") === "single";
  }
  // The first tree below this element that no nested instance owns.
  #ownTree() {
    return this.all(".tr-tree").find((tree) => tree.closest(this.localName) === this) ?? null;
  }
  #createTree() {
    const tree = document.createElement("div");
    tree.className = "tr-tree";
    this.append(tree);
    return tree;
  }
  #rows() {
    return this.#controller?.rows() ?? [];
  }
  #idOf(row) {
    return row.dataset.id ?? (row.querySelector(".tr-text")?.textContent ?? "").trim();
  }
  #rowOf(id) {
    return this.#rows().find((row) => this.#idOf(row) === id);
  }
  #info(row) {
    return { id: this.#idOf(row), label: (row.querySelector(".tr-text")?.textContent ?? "").trim(), depth: (this.#controller?.level(row) ?? 1) - 1 };
  }
  #announceSelection() {
    const ids = this.getSelectedIds();
    const key = ids.join("\n");
    if (key === this.#lastIds) return;
    this.#lastIds = key;
    this.emit("ue-tree-select", { ids });
  }
  // Ids of the selected rows in tree order.
  getSelectedIds() {
    return this.#rows().filter((row) => row.classList.contains("is-selected")).map((row) => this.#idOf(row));
  }
  // Selects exactly these rows. Ids that name no row are ignored.
  select(ids) {
    const controller = this.#controller;
    if (!controller) return;
    const wanted = new Set(this.#single() ? ids.slice(0, 1) : ids);
    const rows = this.#rows().filter((row) => wanted.has(this.#idOf(row)));
    controller.setSelection(rows, rows[rows.length - 1] ?? null);
  }
  // Opens or closes one row.
  setExpanded(id, expanded) {
    const row = this.#rowOf(id);
    if (row && this.#controller?.hasChildren(row)) this.#controller.setOpen(row, expanded);
  }
  // Replaces every row with rows drawn from data.
  setRows(rows) {
    const tree = this.#tree;
    const controller = this.#controller;
    if (!tree || !controller) return;
    tree.replaceChildren(...rows.map((data) => this.#draw(data)));
    this.#lastIds = this.getSelectedIds().join("\n");
    this.#refilter();
    controller.refresh();
  }
  // Adds one row after the last row. It does not touch the selection.
  appendRow(data) {
    if (!this.#tree || !this.#controller) return;
    this.#tree.append(this.#draw(data));
    this.#refilter();
    this.#controller.refresh();
  }
  #draw(data) {
    const depth = data.depth ?? 0;
    const row = document.createElement("div");
    row.className = "tr-row" + (data.selected ? " is-selected" : "") + (data.dim ? " is-dim" : "");
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", String(depth + 1));
    row.setAttribute("aria-expanded", data.expanded ? "true" : "false");
    row.dataset.id = data.id;
    if (data.expandable) row.dataset.expandable = "true";
    const icon = data.icon ?? "object";
    const cells = (data.cells ?? []).map(() => '<span class="tr-cell"></span>').join("");
    row.innerHTML = '<span class="tr-indent" style="--depth:' + depth + '"></span>' + ARROW + (icon === "folder" ? FOLDER2 : icon === "object" ? OBJECT : "") + '<span class="tr-text"></span>' + cells;
    const text = row.querySelector(".tr-text");
    if (text) text.textContent = data.label;
    const cellEls = row.querySelectorAll(".tr-cell");
    (data.cells ?? []).forEach((value, i) => {
      cellEls[i].textContent = value;
    });
    return row;
  }
  // Shows only the rows the filter accepts and their ancestors. Ancestors open while the filter is set. Null clears it.
  setFilter(filter) {
    if (typeof filter === "string") {
      const needle = filter.trim().toLowerCase();
      this.#filter = needle === "" ? null : (row) => row.label.toLowerCase().includes(needle);
    } else {
      this.#filter = filter;
    }
    this.#refilter();
    this.#controller?.refresh();
  }
  #refilter() {
    this.#kept = /* @__PURE__ */ new Set();
    this.#parentsOfKept = /* @__PURE__ */ new Set();
    const filter = this.#filter;
    const controller = this.#controller;
    if (!filter || !controller) return;
    const rows = this.#rows();
    rows.forEach((row, index) => {
      if (!filter(this.#info(row))) return;
      this.#kept.add(row);
      let want = controller.level(row);
      for (let j = index - 1; j >= 0 && want > 1; j--) {
        const level = controller.level(rows[j]);
        if (level < want) {
          this.#kept.add(rows[j]);
          this.#parentsOfKept.add(rows[j]);
          want = level;
        }
      }
    });
  }
};
define("ue-tree-row", TreeRow);

// design-system/src/SourcePanel/SourcePanel.ts
var SourcePanelElement = class extends UeElement {
  #trees = [];
  #collections = 0;
  setup() {
    this.#trees = this.all("ue-tree-row").filter((tree) => this.owns(tree));
    this.#collections = this.#tree("collections")?.querySelectorAll(".tr-row").length ?? 0;
    for (const area of this.#areas()) this.#markCollapsed(area);
    this.on(this, "ue-tree-select", (event) => {
      const tree = event.target;
      if (!this.owns(tree) || !(tree instanceof TreeRow)) return;
      const [id] = event.detail.ids;
      if (id === void 0) return;
      for (const other of this.#trees) if (other !== tree) other.select([]);
      const name = tree.querySelector(".tr-row.is-selected .tr-text")?.textContent ?? "";
      this.emit("sourcepanel:select", { id, name });
    });
    this.on(this, "ue-expand-toggle", (event) => {
      if (!this.owns(event.target)) return;
      const area = event.target.querySelector(".SourcePanel__area");
      if (area) this.#markCollapsed(area);
    });
    this.on(this, "ue-button-click", (event) => {
      if (!this.owns(event.target)) return;
      if (event.target.dataset.action === "add-collection") this.#addCollection();
    });
  }
  // Replaces the rows of the tree named by its `data-tree` attribute.
  setRows(tree, rows) {
    this.#tree(tree)?.setRows(rows);
  }
  // Selects the row with this id in whichever tree holds it. The other trees lose their selection.
  select(id) {
    for (const tree of this.#trees) tree.select([id]);
  }
  // Opens or closes the row with this id.
  setExpanded(id, expanded) {
    for (const tree of this.#trees) tree.setExpanded(id, expanded);
  }
  #tree(name) {
    return this.#trees.find((tree) => tree.dataset.tree === name);
  }
  #areas() {
    return this.all(".SourcePanel__area").filter((area) => this.owns(area));
  }
  // The area class `is-collapsed` lets a filling area give its height back.
  #markCollapsed(area) {
    area.classList.toggle("is-collapsed", area.querySelector(".expandablearea__header")?.getAttribute("aria-expanded") !== "true");
  }
  #addCollection() {
    const tree = this.#tree("collections");
    if (!tree) return;
    const header = tree.closest(".SourcePanel__area")?.querySelector(".expandablearea__header");
    if (header?.getAttribute("aria-expanded") !== "true") header?.click();
    const label = "NewCollection" + (this.#collections + 1);
    this.#collections++;
    const id = "Collections/" + label;
    tree.appendRow({ id, label, icon: "folder", depth: 0 });
    this.select(id);
  }
};
define("ue-source-panel", SourcePanelElement);

// design-system/src/_shared/drag.ts
var THRESHOLD = 3;
function drag(target, handlers) {
  let originX = 0;
  let originY = 0;
  let active = false;
  let moved = false;
  const down = (event) => {
    if (event.button !== 0) return;
    active = true;
    moved = false;
    originX = event.clientX;
    originY = event.clientY;
    target.setPointerCapture(event.pointerId);
    handlers.start?.(event);
  };
  const move = (event) => {
    if (!active) return;
    const dx = event.clientX - originX;
    const dy = event.clientY - originY;
    if (!moved && Math.hypot(dx, dy) < THRESHOLD) return;
    moved = true;
    handlers.move(event, dx, dy);
  };
  const up = (event) => {
    if (!active) return;
    active = false;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    handlers.end?.(event, moved);
  };
  target.addEventListener("pointerdown", down);
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
  return () => {
    target.removeEventListener("pointerdown", down);
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
  };
}

// design-system/src/Splitter/Splitter.ts
var DEFAULT_MIN = 20;
var DEFAULT_STEP = 5;
var DEFAULT_STEP_LARGE = 20;
var HIGHLIGHT = "splitter-handle--highlight";
function panesOf(handle) {
  const before = handle.previousElementSibling;
  const after = handle.nextElementSibling;
  if (!(before instanceof HTMLElement) || !(after instanceof HTMLElement) || !handle.parentElement) return null;
  return { before, after, vertical: getComputedStyle(handle.parentElement).flexDirection === "column" };
}
var extent = (pane, vertical) => pane.getBoundingClientRect()[vertical ? "height" : "width"];
var SplitterElement = class extends UeElement {
  setup() {
    const handle = this.all(".splitter-handle").find((candidate) => this.owns(candidate));
    if (!handle) throw new Error("ue-splitter needs a .splitter-handle between two panes");
    this.#wire(handle);
  }
  // A number attribute of this element, or the fallback when it is missing or not a number.
  #number(name, fallback) {
    const value = Number(this.getAttribute(name));
    return this.hasAttribute(name) && Number.isFinite(value) ? value : fallback;
  }
  #wire(handle) {
    let startSize = 0;
    let total = 0;
    const minStart = () => this.#number("data-min-start", DEFAULT_MIN);
    const minEnd = () => this.#number("data-min-end", DEFAULT_MIN);
    const resize = (size) => {
      const panes2 = panesOf(handle);
      if (!panes2) return;
      const clamped = Math.min(Math.max(size, minStart()), total - minEnd());
      panes2.before.style.flex = "0 0 " + clamped + "px";
      panes2.after.style.flex = "1 1 0";
      this.#publish(handle, panes2);
      this.emit("ue-splitter-resize", { size: clamped, total, orientation: panes2.vertical ? "vertical" : "horizontal" });
    };
    const measure = () => {
      const panes2 = panesOf(handle);
      if (!panes2) return null;
      startSize = extent(panes2.before, panes2.vertical);
      total = startSize + extent(panes2.after, panes2.vertical);
      return panes2;
    };
    const panes = panesOf(handle);
    if (panes) {
      handle.setAttribute("aria-orientation", panes.vertical ? "horizontal" : "vertical");
      this.#publish(handle, panes);
    }
    this.onDispose(drag(handle, {
      start: () => {
        measure();
        handle.classList.add(HIGHLIGHT);
      },
      move: (_event, dx, dy) => {
        const current = panesOf(handle);
        if (current) resize(startSize + (current.vertical ? dy : dx));
      },
      end: () => handle.classList.remove(HIGHLIGHT)
    }));
    this.on(handle, "keydown", (event) => {
      const current = measure();
      if (!current) return;
      const grow = current.vertical ? "ArrowDown" : "ArrowRight";
      const shrink = current.vertical ? "ArrowUp" : "ArrowLeft";
      const step = event.shiftKey ? this.#number("data-step-shift", DEFAULT_STEP_LARGE) : this.#number("data-step", DEFAULT_STEP);
      if (event.key === grow) resize(startSize + step);
      else if (event.key === shrink) resize(startSize - step);
      else if (event.key === "Home") resize(minStart());
      else if (event.key === "End") resize(total - minEnd());
      else return;
      event.preventDefault();
    });
  }
  // Publishes the position of the handle for assistive technology: the size of the pane before it.
  #publish(handle, panes) {
    const size = extent(panes.before, panes.vertical);
    const total = size + extent(panes.after, panes.vertical);
    handle.setAttribute("aria-valuemin", String(this.#number("data-min-start", DEFAULT_MIN)));
    handle.setAttribute("aria-valuemax", String(Math.round(total - this.#number("data-min-end", DEFAULT_MIN))));
    handle.setAttribute("aria-valuenow", String(Math.round(size)));
  }
};
define("ue-splitter", SplitterElement);

// design-system/src/ContentBrowser/ContentBrowser.ts
var STARTER = [
  ["Architecture", ["Walls", "Floors"]],
  ["Audio", ["Music", "Ambient"]],
  ["Blueprints", ["Actors"]],
  ["HDRI", ["Outdoor"]],
  ["Maps", ["Overview", "Test"]],
  ["Materials", ["Metal", "Wood"]],
  ["Particles", ["Fire", "Smoke"]],
  ["Props", ["Furniture", "Lamps"]],
  ["Shapes", ["Primitives"]],
  ["Textures", ["Brick", "Stone"]]
];
var INITIAL_PICKED = ["Blueprints"];
function child(parent, name) {
  const folder = { id: parent.id + "/" + name, name, parent, kids: [] };
  parent.kids.push(folder);
  return folder;
}
function buildModel() {
  const all = { id: "All", name: "All", parent: null, kids: [] };
  const start = child(child(all, "Content"), "StarterContent");
  for (const [name, kids] of STARTER) {
    const folder = child(start, name);
    for (const kid of kids) child(folder, kid);
  }
  return { all, start };
}
function pathOf(folder) {
  const path = [];
  for (let at = folder; at; at = at.parent) path.unshift(at.name);
  return path;
}
var ContentBrowserElement = class extends UeElement {
  #toolbar;
  #sources;
  #search;
  #grid;
  #status;
  #all;
  #cur;
  #byId = /* @__PURE__ */ new Map();
  #picked = /* @__PURE__ */ new Set();
  setup() {
    this.#toolbar = this.#need("ue-content-toolbar");
    this.#sources = this.#need("ue-source-panel");
    this.#search = this.#need("ue-asset-search-bar");
    this.#grid = this.#need("ue-asset-tile");
    this.#status = this.#need(".ContentBrowser__status");
    const model = buildModel();
    this.#all = model.all;
    this.#cur = model.start;
    const index = (folder) => {
      this.#byId.set(folder.id, folder);
      folder.kids.forEach(index);
    };
    index(model.all);
    this.on(this, "contenttoolbar:navigate", (event) => {
      const folder = this.#byId.get(event.detail.path.join("/"));
      if (folder) this.#show(folder);
    });
    this.on(this, "sourcepanel:select", (event) => {
      const folder = this.#byId.get(event.detail.id);
      if (folder) this.#go(folder);
    });
    this.on(this, "assetsearchbar:change", () => this.#renderAssets());
    this.on(this, "ue-tile-select", (event) => this.#pick(event.detail.ids));
    this.on(this, "ue-tile-open", (event) => {
      const folder = this.#byId.get(event.detail.id);
      if (folder) this.#go(folder);
    });
    const timer = setTimeout(() => this.#populate(), 0);
    this.onDispose(() => clearTimeout(timer));
  }
  #need(selector) {
    const found = this.one(selector);
    if (!found) throw new Error("ue-content-browser needs " + selector);
    return found;
  }
  #populate() {
    const start = this.#cur;
    const open = /* @__PURE__ */ new Set();
    for (let at = start.parent; at; at = at.parent) open.add(at);
    const rows = [];
    const walk = (folder, depth) => {
      rows.push({ id: folder.id, label: folder.name, depth, icon: "folder", expanded: open.has(folder) || folder === start, selected: folder === start });
      for (const kid of folder.kids) walk(kid, depth + 1);
    };
    walk(this.#all, 0);
    this.#sources.setRows("project", rows);
    this.#toolbar.childrenOf = (path) => this.#byId.get(path.join("/"))?.kids.map((kid) => kid.name) ?? [];
    this.#toolbar.setHistory([pathOf(start.parent ?? start), pathOf(start)], 1);
    this.#picked = new Set(start.kids.filter((folder) => INITIAL_PICKED.includes(folder.name)));
    this.#search.setPlaceholder("Search " + start.name);
    this.#renderAssets();
  }
  // ---- navigation ----
  #go(folder) {
    if (folder === this.#cur) return;
    this.#toolbar.navigate(pathOf(folder));
    this.#show(folder);
  }
  #show(folder) {
    this.#cur = folder;
    this.#picked.clear();
    for (let at = folder.parent; at; at = at.parent) this.#sources.setExpanded(at.id, true);
    this.#sources.select(folder.id);
    this.#search.setPlaceholder("Search " + folder.name);
    this.#search.setText("");
    this.#renderAssets();
    this.emit("contentbrowser:navigate", { path: pathOf(folder) });
  }
  // ---- assets ----
  #shown() {
    const query = this.#search.text.trim().toLowerCase();
    return this.#cur.kids.filter((folder) => folder.name.toLowerCase().includes(query));
  }
  #renderAssets() {
    const shown = this.#shown();
    const hadFocus = this.#grid.contains(document.activeElement);
    this.#grid.setTiles(shown.map((folder) => ({ id: folder.id, label: folder.name, kind: "folder", selected: this.#picked.has(folder) })));
    if (hadFocus) this.#grid.querySelector('.AssetTile[tabindex="0"]')?.focus();
    this.#renderStatus(shown);
  }
  // A pick replaces the selection among the shown tiles. A hidden tile keeps its mark.
  #pick(ids) {
    const shown = this.#shown();
    for (const folder of shown) this.#picked.delete(folder);
    for (const id of ids) {
      const folder = this.#byId.get(id);
      if (folder) this.#picked.add(folder);
    }
    this.#renderStatus(shown);
  }
  #renderStatus(shown) {
    const picked = shown.filter((folder) => this.#picked.has(folder)).length;
    const count = shown.length === 1 ? "1 item" : shown.length + " items";
    this.#status.textContent = picked === 0 ? count : count + " (" + picked + " selected)";
  }
};
define("ue-content-browser", ContentBrowserElement);
export {
  ContentBrowserElement
};
