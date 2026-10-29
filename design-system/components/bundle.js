/* @ds-bundle: {"format":4,"namespace":"UEStarship","components":[]} */
(() => {
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

  // design-system/src/_shared/popupmenu.ts
  function wireMenu(wiring) {
    const { trigger, menu, itemSelector } = wiring;
    const items = () => Array.from(menu.querySelectorAll(itemSelector));
    const isOpen = () => menu.classList.contains("is-open");
    const setOpen = (open2) => {
      menu.classList.toggle("is-open", open2);
      trigger.setAttribute("aria-expanded", String(open2));
      wiring.onOpenChange?.(open2);
    };
    const open = () => {
      setOpen(true);
      const list = items();
      const start = list.find((item) => item.getAttribute("aria-checked") === "true" || item.getAttribute("aria-selected") === "true") ?? list[0];
      start?.focus();
    };
    const close = (returnFocus) => {
      if (!isOpen()) return;
      setOpen(false);
      if (returnFocus) trigger.focus();
    };
    const move = (delta, absolute) => {
      const list = items();
      const at = list.indexOf(document.activeElement);
      const next = absolute ?? (at < 0 ? 0 : (at + delta + list.length) % list.length);
      list[next]?.focus();
    };
    const pick = (item) => {
      wiring.onPick(item);
      close(true);
    };
    const onTrigger = () => isOpen() ? close(false) : open();
    const onTriggerKey = (event) => {
      if (event.key === "ArrowDown" && !isOpen()) {
        event.preventDefault();
        open();
      }
    };
    const onMenuClick = (event) => {
      const item = event.target.closest(itemSelector);
      if (item && menu.contains(item)) pick(item);
    };
    const onMenuKey = (event) => {
      const active = document.activeElement;
      if (event.key === "ArrowDown") move(1, null);
      else if (event.key === "ArrowUp") move(-1, null);
      else if (event.key === "Home") move(0, 0);
      else if (event.key === "End") move(0, items().length - 1);
      else if ((event.key === "Enter" || event.key === " ") && items().includes(active)) pick(active);
      else if (event.key === "Escape") close(true);
      else if (event.key === "Tab") close(false);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onOutside = (event) => {
      const target = event.target;
      if (isOpen() && !menu.contains(target) && !trigger.contains(target)) close(false);
    };
    trigger.addEventListener("click", onTrigger);
    trigger.addEventListener("keydown", onTriggerKey);
    menu.addEventListener("click", onMenuClick);
    menu.addEventListener("keydown", onMenuKey);
    document.addEventListener("pointerdown", onOutside);
    return {
      open,
      close,
      isOpen,
      dispose: () => {
        trigger.removeEventListener("click", onTrigger);
        trigger.removeEventListener("keydown", onTriggerKey);
        menu.removeEventListener("click", onMenuClick);
        menu.removeEventListener("keydown", onMenuKey);
        document.removeEventListener("pointerdown", onOutside);
      }
    };
  }

  // design-system/src/AssetPicker/AssetPicker.ts
  var UeAssetPicker = class extends UeElement {
    setup() {
      const row = this.one(".AssetPicker-row");
      const combo = this.one(".AssetPicker-combo");
      const menu = this.one(".AssetPicker-menu");
      const label = this.one(".AssetPicker-combo .label");
      const thumb = this.one(".AssetPicker-thumbFrame");
      const reset = this.one(".AssetPicker-reset");
      if (!row || !combo || !menu || !label) return;
      const fallback = row.dataset.default ?? "None";
      const render = (value) => {
        row.dataset.value = value;
        label.textContent = value;
        for (const item of menu.querySelectorAll(".AssetPicker-menuItem")) item.setAttribute("aria-selected", String(item.dataset.asset === value));
        if (thumb) {
          thumb.title = value === "None" ? "None" : "/Game/Props/" + value + "." + value;
          thumb.setAttribute("aria-label", value);
        }
        if (reset) {
          reset.classList.toggle("is-idle", value === fallback);
          reset.tabIndex = value === fallback ? -1 : 0;
        }
        this.emit("ue-asset-change", { asset: value });
      };
      render(label.textContent ?? fallback);
      const handle = wireMenu({
        trigger: combo,
        menu,
        itemSelector: ".AssetPicker-menuItem",
        onPick: (item) => render(item.dataset.asset ?? fallback)
      });
      this.onDispose(handle.dispose);
      const use = this.one('[data-role="use"]');
      if (use) this.on(use, "click", () => render(row.dataset.selection ?? fallback));
      const browse = this.one('[data-role="browse"]');
      if (browse) this.on(browse, "click", () => this.emit("ue-asset-browse", { asset: row.dataset.value ?? fallback }));
      if (reset) this.on(reset, "click", () => render(fallback));
    }
  };
  define("ue-asset-picker", UeAssetPicker);

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

  // design-system/src/Checkbox/Checkbox.ts
  function disabled(el) {
    return el.getAttribute("aria-disabled") === "true";
  }
  function nextState(el) {
    const state = el.getAttribute("aria-checked");
    if (el.classList.contains("checkbox--tristate")) {
      if (state === "false") return "true";
      return state === "true" ? "mixed" : "false";
    }
    return state === "true" ? "false" : "true";
  }
  var UeCheckboxElement = class extends UeElement {
    setup() {
      const el = this.one(".checkbox, .checkbox-toggle");
      if (!el) throw new Error("ue-checkbox needs a .checkbox or .checkbox-toggle element");
      const pressedClass = el.classList.contains("checkbox") ? "checkbox--pressed" : "checkbox-toggle--pressed";
      this.on(el, "click", () => {
        if (!disabled(el)) this.#toggle(el);
      });
      this.on(el, "keydown", (event) => {
        if (disabled(el) || el !== event.target) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!event.repeat) el.classList.add(pressedClass);
      });
      this.on(el, "keyup", (event) => {
        if (disabled(el) || el !== event.target) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        if (el.classList.contains(pressedClass)) {
          el.classList.remove(pressedClass);
          this.#toggle(el);
        }
      });
      this.on(el, "focusout", () => el.classList.remove(pressedClass));
    }
    #toggle(el) {
      let text;
      let checked;
      if (el.classList.contains("checkbox-toggle")) {
        const on = !el.classList.contains("checkbox-toggle--checked");
        el.classList.toggle("checkbox-toggle--checked", on);
        el.setAttribute("aria-pressed", String(on));
        text = on ? "on" : "off";
        checked = on;
      } else {
        const state = nextState(el);
        el.setAttribute("aria-checked", state);
        text = state === "mixed" ? "undetermined" : state === "true" ? "checked" : "unchecked";
        checked = state === "mixed" ? null : state === "true";
      }
      const label = el.dataset.label ?? el.getAttribute("aria-label") ?? el.querySelector(".checkbox__label")?.textContent?.trim() ?? el.textContent?.trim() ?? "";
      this.emit("ue-checkbox-change", { label, state: text, checked, text: label + " is " + text });
    }
  };
  define("ue-checkbox", UeCheckboxElement);

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
      const live = (target) => this.owns(target) && !target.closest("[data-tr-inert]");
      this.on(tree, "click", (event) => {
        if (live(event.target)) controller.click(event);
      });
      this.on(tree, "dblclick", (event) => {
        if (live(event.target)) controller.doubleClick(event);
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
      return { id: this.#idOf(row), label: (row.querySelector(".tr-text")?.textContent ?? "").trim(), depth: (this.#controller?.level(row) ?? 1) - 1, element: row };
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
    // Sorts the children of every parent with compare. A row keeps its subtree. Selection and open state stay.
    sortChildren(compare) {
      const tree = this.#tree;
      const controller = this.#controller;
      if (!tree || !controller) return;
      const roots = [];
      const stack = [];
      for (const row of this.#rows()) {
        const node = { row, kids: [] };
        const level = controller.level(row);
        stack.length = level - 1;
        (stack[level - 2]?.kids ?? roots).push(node);
        stack[level - 1] = node;
      }
      const flat = [];
      const walk = (list) => {
        list.sort((a, b) => compare(this.#info(a.row), this.#info(b.row)));
        for (const node of list) {
          flat.push(node.row);
          walk(node.kids);
        }
      };
      walk(roots);
      tree.append(...flat);
      controller.refresh();
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

  // design-system/src/Cover/Cover.ts
  var TOKENS = {
    primary: "primary",
    panel: "panel",
    inactive: "select-inactive",
    folder: "accent-folder",
    green: "accent-green",
    header: "header"
  };
  var UeCoverElement = class extends UeElement {
    setup() {
      for (const strip of this.all("rect.tile")) {
        const token = Object.keys(TOKENS).find((name) => strip.classList.contains(name));
        if (!token || strip.querySelector("title")) continue;
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = TOKENS[token];
        strip.append(title);
      }
    }
  };
  define("ue-cover", UeCoverElement);

  // design-system/src/DetailsCategory/DetailsCategory.ts
  var DOWN = "#DetailsCategory-down";
  var RIGHT = "#DetailsCategory-right";
  var isIn = (el, selector) => el.closest(selector);
  var UeDetailsCategory = class extends UeElement {
    setup() {
      const frame = this.one(".DetailsCategory-frame");
      if (!frame) return;
      this.wireFrame(frame);
      if (this.one(".DetailsCategory-panel")) this.wirePanel(frame);
      for (const row of this.all(".DetailsCategory-row")) this.syncReset(row);
      this.refresh(frame);
    }
    query() {
      return (this.one(".DetailsCategory-srInput")?.value ?? "").trim().toLowerCase();
    }
    section() {
      return this.one(".DetailsCategory-pill.is-checked")?.dataset.section ?? "";
    }
    modifiedOnly() {
      return this.one('[data-option="modified"]')?.getAttribute("aria-checked") === "true";
    }
    wireFrame(frame) {
      this.on(frame, "click", (event) => {
        const target = event.target;
        const catRow = isIn(target, ".DetailsCategory-catRow");
        const advRow = isIn(target, ".DetailsCategory-advRow");
        const arrow = isIn(target, ".DetailsCategory-rowArrow.has-children");
        const check = isIn(target, '.DetailsCategory-check[role="checkbox"]');
        const reset = isIn(target, '.DetailsCategory-reset[role="button"]');
        if (catRow) catRow.closest(".DetailsCategory-cat")?.classList.toggle("is-collapsed");
        else if (advRow) advRow.closest(".DetailsCategory-adv")?.classList.toggle("is-open");
        else if (arrow) arrow.closest(".DetailsCategory-row")?.classList.toggle("is-collapsed");
        else if (check) {
          const on = check.getAttribute("aria-checked") !== "true";
          check.setAttribute("aria-checked", String(on));
          check.classList.toggle("is-off", !on);
          return;
        } else if (reset) {
          const row = reset.closest(".DetailsCategory-row");
          const text = row?.querySelector(".DetailsCategory-text");
          if (row && text) {
            text.textContent = row.dataset.default ?? "";
            this.syncReset(row);
            this.refresh(frame);
          }
          return;
        } else return;
        this.refresh(frame);
      });
      this.on(frame, "keydown", (event) => {
        const target = event.target;
        const catRow = target.matches(".DetailsCategory-catRow") ? target.closest(".DetailsCategory-cat") : null;
        if (catRow && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault();
          catRow.classList.toggle("is-collapsed", event.key === "ArrowLeft");
          this.refresh(frame);
          return;
        }
        const activates = target.matches(".DetailsCategory-catRow, .DetailsCategory-advRow, .DetailsCategory-rowArrow, .DetailsCategory-check, .DetailsCategory-reset");
        if (activates && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
      });
      this.on(frame, "focusin", (event) => {
        const text = isIn(event.target, ".DetailsCategory-text");
        if (text) text.dataset.before = text.textContent ?? "";
      });
      this.on(frame, "keydown", (event) => {
        const text = isIn(event.target, ".DetailsCategory-text");
        if (!text) return;
        if (event.key === "Enter") {
          event.preventDefault();
          text.blur();
        } else if (event.key === "Escape") {
          text.textContent = text.dataset.before ?? "";
          text.blur();
        }
      });
      this.on(frame, "focusout", (event) => {
        const text = isIn(event.target, ".DetailsCategory-text");
        const row = text?.closest(".DetailsCategory-row");
        if (!text || !row) return;
        text.textContent = (text.textContent ?? "").trim();
        this.syncReset(row);
        this.refresh(frame);
      });
    }
    // The reset arrow shows only while the text differs from the row default.
    syncReset(row) {
      const text = row.querySelector(".DetailsCategory-text");
      const reset = row.querySelector('.DetailsCategory-reset[role="button"]');
      if (!text || !reset || row.dataset.default === void 0) return;
      const idle = (text.textContent ?? "") === row.dataset.default;
      reset.classList.toggle("is-idle", idle);
      reset.tabIndex = idle ? -1 : 0;
    }
    wirePanel(frame) {
      const input = this.one(".DetailsCategory-srInput");
      const clear = this.one(".DetailsCategory-srClear");
      if (input && clear) {
        const sync = () => {
          input.classList.toggle("has-value", input.value !== "");
          clear.classList.toggle("is-hidden", input.value === "");
          this.refresh(frame);
        };
        const wipe = () => {
          input.value = "";
          sync();
          input.focus();
        };
        this.on(input, "input", sync);
        this.on(input, "keydown", (event) => {
          if (event.key === "Escape" && input.value !== "") {
            event.preventDefault();
            wipe();
          }
        });
        this.on(clear, "click", wipe);
      }
      const name = this.one(".DetailsCategory-hdrName");
      if (name) {
        let before = name.textContent ?? "";
        this.on(name, "focus", () => {
          before = name.textContent ?? "";
        });
        this.on(name, "keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            name.blur();
          } else if (event.key === "Escape") {
            name.textContent = before;
            name.blur();
          }
        });
        this.on(name, "blur", () => {
          const text = (name.textContent ?? "").trim();
          name.textContent = text === "" ? before : text;
        });
      }
      const lock = this.one('[data-role="lock"]');
      if (lock) {
        this.on(lock, "click", () => {
          const on = lock.getAttribute("aria-pressed") !== "true";
          lock.setAttribute("aria-pressed", String(on));
          lock.querySelector("use")?.setAttribute("href", on ? "#DetailsCategory-locked" : "#DetailsCategory-unlock");
        });
      }
      const star = this.one('[data-role="favorites"]');
      if (star) {
        this.on(star, "click", () => {
          const on = star.getAttribute("aria-pressed") !== "true";
          star.setAttribute("aria-pressed", String(on));
          star.classList.toggle("is-on", on);
        });
      }
      const gear = this.one('[data-role="options"]');
      const menu = this.one(".DetailsCategory-menu");
      if (gear && menu) {
        const handle = wireMenu({
          trigger: gear,
          menu,
          itemSelector: ".DetailsCategory-menuItem",
          onPick: (item) => {
            const option = item.dataset.option;
            if (option === "modified") item.setAttribute("aria-checked", String(item.getAttribute("aria-checked") !== "true"));
            else if (option === "collapseAll" || option === "expandAll") {
              for (const cat of this.all(".DetailsCategory-cat")) cat.classList.toggle("is-collapsed", option === "collapseAll");
            }
            this.refresh(frame);
          }
        });
        this.onDispose(handle.dispose);
      }
      const strip = this.one(".DetailsCategory-pills");
      if (strip) {
        const pills = () => Array.from(strip.querySelectorAll(".DetailsCategory-pill"));
        const select = (pill, focus) => {
          for (const other of pills()) {
            other.classList.toggle("is-checked", other === pill);
            other.setAttribute("aria-selected", String(other === pill));
            other.tabIndex = other === pill ? 0 : -1;
          }
          if (focus) pill.focus();
          this.refresh(frame);
        };
        this.on(strip, "click", (event) => {
          const pill = isIn(event.target, ".DetailsCategory-pill");
          if (pill) select(pill, false);
        });
        this.on(strip, "keydown", (event) => {
          const all = pills();
          const at = all.indexOf(document.activeElement);
          if (at < 0) return;
          let next = -1;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % all.length;
          else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + all.length) % all.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = all.length - 1;
          if (next < 0) return;
          event.preventDefault();
          select(all[next], true);
        });
      }
    }
    // Recomputes which cats, rows and the Advanced bar show, and the arrow glyphs.
    refresh(frame) {
      const query = this.query();
      const searching = query !== "";
      const section = this.section();
      const onlyModified = this.modifiedOnly();
      const items = [];
      for (const el of Array.from(frame.children)) {
        if (el.classList.contains("DetailsCategory-cat")) items.push({ el, kind: "cat", level: 0, matchesText: true, isModified: true });
        else if (el.classList.contains("DetailsCategory-adv")) items.push({ el, kind: "adv", level: 0, matchesText: true, isModified: true });
        else if (el.classList.contains("DetailsCategory-row")) {
          const label = (el.querySelector(".DetailsCategory-label")?.textContent ?? "").toLowerCase();
          const reset = el.querySelector('.DetailsCategory-reset[role="button"]');
          items.push({
            el,
            kind: "row",
            level: el.querySelectorAll(":scope > .DetailsCategory-indent").length,
            matchesText: !searching || label.includes(query),
            isModified: !onlyModified || reset !== null && !reset.classList.contains("is-idle")
          });
        }
      }
      const keep = items.map((item, i) => {
        if (item.kind !== "row") return true;
        let textOk = item.matchesText;
        let modOk = item.isModified;
        let want = item.level;
        for (let j = i - 1; j >= 0 && items[j].kind !== "cat" && want > 0; j--) {
          if (items[j].kind === "row" && items[j].level < want) {
            textOk = textOk || items[j].matchesText;
            want = items[j].level;
          }
        }
        for (let j = i + 1; j < items.length && items[j].kind === "row" && items[j].level > item.level; j++) {
          textOk = textOk || items[j].matchesText;
          modOk = modOk || items[j].isModified;
        }
        return textOk && modOk;
      });
      let anyCatShown = false;
      let cat = null;
      let catHidden = false;
      let catFolded = false;
      let catHasRows = false;
      let advOpen = true;
      let inAdv = false;
      const closed = [];
      const finishCat = () => {
        if (!cat) return;
        const empty = !catHasRows && (searching || onlyModified);
        cat.classList.toggle("is-hidden", catHidden || empty);
        if (!catHidden && !empty) anyCatShown = true;
      };
      items.forEach((item, i) => {
        const { el } = item;
        if (item.kind === "cat") {
          finishCat();
          cat = el;
          const own = el.dataset.section;
          catHidden = section !== "" && own !== void 0 && own !== section;
          catFolded = el.classList.contains("is-collapsed") && !searching;
          catHasRows = false;
          inAdv = false;
          closed.length = 0;
          this.setArrow(el.querySelector(".DetailsCategory-arrow use"), !catFolded);
          el.querySelector(".DetailsCategory-catRow")?.setAttribute("aria-expanded", String(!catFolded));
        } else if (item.kind === "adv") {
          inAdv = true;
          advOpen = el.classList.contains("is-open") || searching;
          el.classList.toggle("is-hidden", catHidden || catFolded || searching);
          this.setArrow(el.querySelector(".DetailsCategory-arrow use"), advOpen);
          el.querySelector(".DetailsCategory-advRow")?.setAttribute("aria-expanded", String(advOpen));
        } else {
          closed.length = item.level;
          const parentClosed = !searching && closed.some(Boolean);
          const hidden = catHidden || catFolded || parentClosed || inAdv && !advOpen || !keep[i];
          el.classList.toggle("is-hidden", hidden);
          const toggle = el.querySelector(".DetailsCategory-rowArrow.has-children");
          const folded = toggle !== null && el.classList.contains("is-collapsed") && !searching;
          closed[item.level] = folded;
          if (toggle) {
            this.setArrow(toggle.querySelector("use"), !folded);
            toggle.setAttribute("aria-expanded", String(!folded));
          }
          if (!hidden) catHasRows = true;
        }
      });
      finishCat();
      frame.querySelector(".DetailsCategory-empty")?.classList.toggle("is-shown", !anyCatShown && (searching || section !== "" || onlyModified));
    }
    setArrow(use, expanded) {
      use?.setAttribute("href", expanded ? DOWN : RIGHT);
    }
  };
  define("ue-details-category", UeDetailsCategory);

  // design-system/src/DetailsHeader/DetailsHeader.ts
  var UeDetailsHeader = class extends UeElement {
    setup() {
      const lock = this.one(".DetailsHeader-lock");
      const label = this.one(".DetailsHeader-label");
      if (lock) this.on(lock, "click", () => this.setLocked(lock, lock.getAttribute("aria-pressed") !== "true"));
      if (label) this.wireLabel(label);
    }
    setLocked(lock, locked) {
      lock.setAttribute("aria-pressed", String(locked));
      lock.querySelector("use")?.setAttribute("href", locked ? "#DetailsHeader-locked" : "#DetailsHeader-unlock");
    }
    // Enter commits, Escape restores the text from before the edit. The instance row shows the committed name.
    wireLabel(label) {
      let before = label.textContent ?? "";
      this.on(label, "focus", () => {
        before = label.textContent ?? "";
      });
      this.on(label, "keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          label.blur();
        } else if (event.key === "Escape") {
          label.textContent = before;
          label.blur();
        }
      });
      this.on(label, "blur", () => {
        const text = (label.textContent ?? "").trim();
        label.textContent = text === "" ? before : text;
        for (const name of this.all(".DetailsHeader-instance .name")) name.textContent = label.textContent;
      });
    }
  };
  define("ue-details-header", UeDetailsHeader);

  // design-system/src/DetailsSearchRow/DetailsSearchRow.ts
  var UeDetailsSearchRow = class extends UeElement {
    setup() {
      const input = this.one(".DetailsSearchRow-text");
      const clear = this.one(".DetailsSearchRow-clear");
      if (input && clear) this.wireSearch(input, clear);
      const star = this.one('[data-role="favorites"]');
      if (star) {
        this.on(star, "click", () => {
          const on = star.getAttribute("aria-pressed") !== "true";
          star.setAttribute("aria-pressed", String(on));
          star.classList.toggle("is-on", on);
          star.title = on ? "Toggle Favorites (on)" : "Toggle Favorites";
          this.emit("ue-favorites", { on });
        });
      }
      const gear = this.one('[data-role="options"]');
      const menu = this.one(".DetailsSearchRow-menu");
      if (gear && menu) {
        const handle = wireMenu({
          trigger: gear,
          menu,
          itemSelector: ".DetailsSearchRow-menuItem",
          onPick: (item) => {
            if (item.getAttribute("role") === "menuitemcheckbox") item.setAttribute("aria-checked", String(item.getAttribute("aria-checked") !== "true"));
            this.emit("ue-view-option", { option: item.dataset.option ?? "", checked: item.getAttribute("aria-checked") === "true" });
          }
        });
        this.onDispose(handle.dispose);
      }
    }
    wireSearch(input, clear) {
      const sync = () => {
        const hasText = input.value !== "";
        input.classList.toggle("has-value", hasText);
        clear.classList.toggle("is-hidden", !hasText);
        this.emit("ue-search", { text: input.value });
      };
      const wipe = () => {
        input.value = "";
        sync();
        input.focus();
      };
      this.on(input, "input", sync);
      this.on(input, "keydown", (event) => {
        if (event.key === "Escape" && input.value !== "") {
          event.preventDefault();
          wipe();
        }
      });
      this.on(clear, "click", wipe);
      this.on(clear, "keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") wipe();
      });
    }
  };
  define("ue-details-search-row", UeDetailsSearchRow);

  // design-system/src/_shared/tabstack.ts
  var TARGET_KEYS = ["ArrowRight", "ArrowLeft", "Home", "End"];
  function targetElement(event) {
    return event.target instanceof Element ? event.target : null;
  }
  var TabStackElement = class extends UeElement {
    #snapshot = null;
    setup() {
      this.#snapshot ??= this.innerHTML;
      this.on(this, "pointerdown", (event) => {
        if (event.button !== 0 && event.button !== 2) return;
        const target = targetElement(event);
        const tab = target?.closest("." + this.names.tab);
        if (!tab || !this.owns(tab) || target?.closest("." + this.names.close)) return;
        this.#activate(tab);
      });
      this.on(this, "click", (event) => {
        const target = targetElement(event);
        if (!this.owns(target)) return;
        const closeButton = target?.closest("." + this.names.close);
        if (closeButton) {
          const tab = closeButton.closest("." + this.names.tab);
          if (tab) this.#close(tab);
          return;
        }
        if (target?.closest("." + this.names.reset)) this.#restore();
      });
      this.on(this, "auxclick", (event) => {
        if (event.button !== 1) return;
        const tab = targetElement(event)?.closest("." + this.names.tab);
        if (!tab || !this.owns(tab)) return;
        event.preventDefault();
        this.#close(tab);
      });
      this.on(this, "keydown", (event) => {
        const tab = targetElement(event)?.closest("." + this.names.tab);
        if (!tab || event.target !== tab || !this.owns(tab)) return;
        const stack = tab.closest("." + this.names.stack);
        if (!stack) return;
        const tabs = this.#tabsOf(stack);
        const index = tabs.indexOf(tab);
        if (TARGET_KEYS.includes(event.key)) {
          const target = this.#neighbour(tabs, index, event.key);
          event.preventDefault();
          this.#activate(target);
          target.focus();
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.#activate(tab);
        } else if (event.key === "Delete") {
          event.preventDefault();
          this.#close(tab);
        }
      });
    }
    #neighbour(tabs, index, key) {
      if (key === "Home") return tabs[0];
      if (key === "End") return tabs[tabs.length - 1];
      const step = key === "ArrowRight" ? 1 : -1;
      return tabs[(index + step + tabs.length) % tabs.length];
    }
    #tabsOf(stack) {
      const well = stack.querySelector("." + this.names.well);
      return Array.from(well?.children ?? []).filter((child2) => child2 instanceof HTMLElement && child2.classList.contains(this.names.tab));
    }
    // The panel of this tab. A panel that belongs to a stack nested inside this
    // never matches.
    #panelOf(stack, tab) {
      const panels = Array.from(stack.querySelectorAll("[data-panel]")).filter((panel) => panel.closest("." + this.names.stack) === stack);
      return panels.find((panel) => panel.dataset.panel === tab.dataset.tab) ?? null;
    }
    #detail(tab) {
      const label = (tab.querySelector("." + this.names.label)?.textContent ?? "").trim();
      return { id: tab.dataset.tab ?? label, label };
    }
    // Every tab of this element in document order, each owned by this element.
    tabs() {
      return this.all("." + this.names.tab).filter((tab) => this.owns(tab));
    }
    // Makes the tab with this data-tab the foreground tab and the active one.
    activateTab(id) {
      const tab = this.tabs().find((candidate) => this.#detail(candidate).id === id);
      if (tab) this.#activate(tab);
    }
    // Closes the tab with this data-tab.
    closeTab(id) {
      const tab = this.tabs().find((candidate) => this.#detail(candidate).id === id);
      if (tab) this.#close(tab);
    }
    // Every active tab of every live stack of this component in the page.
    #activeTabs() {
      const selector = this.tagName.toLowerCase() + " ." + this.names.tab + "." + this.names.active;
      return Array.from(document.querySelectorAll(selector));
    }
    // Makes the tab the foreground tab of its stack and shows its panel.
    #bringToFront(stack, tab) {
      const changed = !tab.classList.contains(this.names.foreground);
      for (const candidate of this.#tabsOf(stack)) {
        const foreground = candidate === tab;
        candidate.classList.toggle(this.names.foreground, foreground);
        candidate.setAttribute("aria-selected", String(foreground));
        candidate.tabIndex = foreground ? 0 : -1;
        const panel = this.#panelOf(stack, candidate);
        if (panel) panel.hidden = !foreground;
      }
      if (changed) this.emit("ue-tab-activate", this.#detail(tab));
    }
    // Foreground plus active. One tab per page is active, like the focused stack of the editor.
    #activate(tab) {
      const stack = tab.closest("." + this.names.stack);
      if (!stack) return;
      this.#bringToFront(stack, tab);
      for (const other of this.#activeTabs()) other.classList.remove(this.names.active);
      tab.classList.add(this.names.active);
    }
    // SDockingTabWell::RemoveAndDestroyTab, SDockingTabWell.cpp:617-633: closing the foreground tab selects its left neighbour, or the new first tab.
    #close(tab) {
      const stack = tab.closest("." + this.names.stack);
      if (!stack) return;
      const tabs = this.#tabsOf(stack);
      const index = tabs.indexOf(tab);
      const old = tabs.findIndex((candidate) => candidate.classList.contains(this.names.foreground));
      const hadFocus = tab.contains(document.activeElement);
      const wasActive = tab.classList.contains(this.names.active);
      const closed = this.#detail(tab);
      this.#panelOf(stack, tab)?.remove();
      tab.remove();
      this.emit("ue-tab-close", closed);
      const rest = tabs.filter((candidate) => candidate !== tab);
      if (rest.length === 0) return;
      let next;
      if (old === -1) next = rest[0];
      else if (index <= old) next = rest[Math.max(old - 1, 0)];
      else next = rest[old];
      if (wasActive) this.#activate(next);
      else this.#bringToFront(stack, next);
      if (hadFocus) next.focus();
    }
    // Puts back the markup this element had when it first connected.
    #restore() {
      if (this.#snapshot === null) return;
      this.innerHTML = this.#snapshot;
      const tabs = this.all("." + this.names.tab);
      for (const tab of tabs) tab.classList.remove(this.names.active);
      const foreground = tabs.find((tab) => tab.classList.contains(this.names.foreground));
      if (foreground && this.#activeTabs().length === 0) foreground.classList.add(this.names.active);
    }
  };

  // design-system/src/DockTab/DockTab.ts
  var DockTabElement = class extends TabStackElement {
    names = {
      stack: "dockTab-stack",
      well: "dockTab-well",
      tab: "dockTab",
      label: "dockTab-label",
      close: "dockTab-close",
      reset: "dockTab-reset",
      foreground: "dockTab--foreground",
      active: "dockTab--active"
    };
  };
  define("ue-dock-tab", DockTabElement);

  // design-system/src/EventStatus/EventStatus.ts
  var UeEventStatusElement = class extends UeElement {
    setup() {
      const host = this.parentElement;
      const type = this.getAttribute("event");
      if (!host || !type) throw new Error("ue-event-status needs a parent element and an event attribute");
      const template = this.getAttribute("template") ?? "{value}";
      this.on(host, type, (event) => {
        const detail = event.detail ?? {};
        this.textContent = template.replace(/\{(\w+)\}/g, (_match, key) => String(detail[key] ?? ""));
      });
    }
  };
  define("ue-event-status", UeEventStatusElement);

  // design-system/src/HeaderRow/HeaderRow.ts
  var CELL = ".hr-cell";
  var SORTABLE = ".hr-cell[aria-sort]";
  var GRIP = ".hr-grip";
  var ARROW2 = ".hr-sort";
  var GLYPH = {
    up: "M2 8l4-5 4 5z",
    down: "M2 4l4 5 4-5z",
    up2: "M2 6.2l4-4 4 4zM2 10.5l4-4 4 4z",
    down2: "M2 1.5l4 4 4-4zM2 5.8l4 4 4-4z"
  };
  var SVG_NS = "http://www.w3.org/2000/svg";
  var MIN_WIDTH = 20;
  var KEY_STEP = 8;
  function modeOf(cell) {
    const value = cell.getAttribute("aria-sort");
    return value === "ascending" || value === "descending" ? value : "none";
  }
  function priorityOf(cell) {
    return cell.dataset.priority === "secondary" ? "secondary" : "primary";
  }
  function paint(cell, mode, priority) {
    cell.setAttribute("aria-sort", mode);
    cell.dataset.priority = priority;
    let arrow = cell.querySelector(ARROW2);
    if (!arrow) {
      arrow = document.createElementNS(SVG_NS, "svg");
      arrow.setAttribute("class", "hr-sort");
      arrow.setAttribute("viewBox", "0 0 12 12");
      arrow.setAttribute("aria-hidden", "true");
      const grip = cell.querySelector(GRIP);
      if (grip) cell.insertBefore(arrow, grip);
      else cell.append(arrow);
    }
    let path = arrow.querySelector("path");
    if (!path) {
      path = document.createElementNS(SVG_NS, "path");
      arrow.append(path);
    }
    arrow.toggleAttribute("hidden", mode === "none");
    path.setAttribute("d", GLYPH[(mode === "descending" ? "down" : "up") + (priority === "secondary" ? "2" : "")]);
  }
  var HeaderRow = class extends UeElement {
    setup() {
      const sortable = () => this.all(SORTABLE).filter((cell) => this.owns(cell));
      for (const cell of sortable()) paint(cell, modeOf(cell), priorityOf(cell));
      const activate = (cell, shift) => {
        let mode = modeOf(cell);
        let priority = priorityOf(cell);
        if (mode === "none") {
          priority = shift ? "secondary" : "primary";
          mode = "ascending";
        } else {
          if (!shift && priority === "secondary") priority = "primary";
          mode = mode === "descending" ? "ascending" : "descending";
        }
        for (const other of sortable()) {
          if (other !== cell && modeOf(other) !== "none" && priorityOf(other) === priority) paint(other, "none", priority);
        }
        paint(cell, mode, priority);
        this.emit("ue-sort", { column: cell.dataset.column ?? "", mode, direction: mode, priority });
      };
      this.on(this, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element) || target.closest(GRIP) || !this.owns(target)) return;
        const cell = target.closest(SORTABLE);
        if (cell && this.contains(cell)) activate(cell, event.shiftKey);
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.matches(SORTABLE) || !this.owns(target)) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate(target, event.shiftKey);
      });
      const grips = this.all(GRIP).filter((grip) => this.owns(grip));
      const resizable = this.getAttribute("grips") !== "off";
      for (const grip of grips) {
        grip.hidden = !resizable;
        if (resizable) this.#bindGrip(grip);
      }
    }
    #bindGrip(grip) {
      const left = grip.closest(CELL);
      const right = left?.nextElementSibling;
      const cells = left?.parentElement;
      if (!left || !(right instanceof HTMLElement) || !right.matches(CELL) || !cells) return;
      let startLeft = 0;
      let total = 0;
      const apply = (width) => {
        const clamped = Math.min(total - MIN_WIDTH, Math.max(MIN_WIDTH, width));
        left.style.flex = clamped + " 1 " + clamped + "px";
        right.style.flex = total - clamped + " 1 " + (total - clamped) + "px";
        grip.setAttribute("aria-valuenow", String(Math.round(clamped)));
        this.emit("ue-column-resize", { column: left.dataset.column ?? "", width: clamped, nextColumn: right.dataset.column ?? "", nextWidth: total - clamped });
      };
      const measure = () => {
        const flexible = Array.from(cells.children).filter((cell) => cell instanceof HTMLElement && cell.matches(CELL) && getComputedStyle(cell).flexGrow !== "0");
        const widths = flexible.map((cell) => cell.getBoundingClientRect().width);
        flexible.forEach((cell, i) => {
          cell.style.flex = widths[i] + " 1 " + widths[i] + "px";
        });
        startLeft = left.getBoundingClientRect().width;
        total = startLeft + right.getBoundingClientRect().width;
      };
      this.onDispose(drag(grip, {
        start: measure,
        move: (_event, dx) => apply(startLeft + dx)
      }));
      this.on(grip, "keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        measure();
        apply(startLeft + (event.key === "ArrowLeft" ? -KEY_STEP : KEY_STEP));
      });
      this.on(grip, "click", (event) => event.stopPropagation());
    }
  };
  define("ue-header-row", HeaderRow);

  // design-system/src/MenuBar/MenuBar.ts
  var TRIGGER = ".combobutton";
  var PANEL = ".combobutton-menu";
  var CURRENT_ROW = ".popupmenu__row--hover";
  var MenuBar = class extends UeElement {
    setup() {
      const combos = () => this.all("ue-combo-button");
      const triggerOf = (combo) => combo.querySelector(TRIGGER);
      const openCombo = () => combos().find((combo) => combo.isOpen);
      const setCurrent = (trigger) => {
        for (const other of combos()) {
          const own = triggerOf(other);
          if (own) own.tabIndex = own === trigger ? 0 : -1;
        }
      };
      const step = (combo, delta) => {
        const list = combos();
        return list[(list.indexOf(combo) + delta + list.length) % list.length];
      };
      const moveTo = (from, next, keys) => {
        from?.close(false);
        next.open(keys, false);
        const trigger = triggerOf(next);
        if (trigger) setCurrent(trigger);
      };
      this.on(this, "pointerover", (event) => {
        const trigger = event.target instanceof Element ? event.target.closest(TRIGGER) : null;
        const combo = trigger?.closest("ue-combo-button");
        const open = openCombo();
        if (combo && open && open !== combo) moveTo(open, combo, false);
      });
      this.on(this, "focusin", (event) => {
        const trigger = event.target instanceof Element ? event.target.closest(TRIGGER) : null;
        if (trigger) setCurrent(trigger);
      });
      this.on(this, "ue-combo-pick", (event) => {
        this.emit("ue-menu-select", { label: event.detail.label });
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        const combo = target.closest("ue-combo-button");
        if (!combo) return;
        const inPanel = target.closest(PANEL) !== null;
        if (inPanel) {
          const current = combo.querySelector(CURRENT_ROW);
          if (event.key === "ArrowRight" && current?.hasAttribute("aria-haspopup")) return;
          if (event.key === "ArrowLeft" && current?.closest(".popupmenu__sub")) return;
        } else if (target !== triggerOf(combo)) {
          return;
        }
        event.preventDefault();
        const next = step(combo, event.key === "ArrowRight" ? 1 : -1);
        const open = openCombo();
        if (inPanel || open) {
          moveTo(open, next, inPanel);
          return;
        }
        const trigger = triggerOf(next);
        if (!trigger) return;
        trigger.focus();
        setCurrent(trigger);
      });
    }
  };
  define("ue-menu-bar", MenuBar);

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

  // design-system/src/PlaceActorsPanel/PlaceActorsPanel.ts
  var GROUP = ".placeActors-group";
  var ROW2 = ".placeActors-row";
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
          for (const row of Array.from(group.querySelectorAll(ROW2))) {
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
        const row = target.closest(ROW2);
        if (row) this.emit("ue-place", { name: row.querySelector(".placeActors-name")?.textContent ?? "" });
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.matches(ROW2) && event.key === "Enter") {
          event.preventDefault();
          this.emit("ue-place", { name: target.querySelector(".placeActors-name")?.textContent ?? "" });
        }
      });
      const active = this.one(".SegmentedControl-seg.is-checked");
      if (active) show(active.dataset.value ?? "");
    }
  };
  define("ue-place-actors-panel", PlaceActorsPanel);

  // design-system/src/ResetToDefault/ResetToDefault.ts
  var UeResetToDefaultElement = class extends UeElement {
    static observedAttributes = ["differs"];
    attributeChangedCallback() {
      this.#sync();
    }
    setup() {
      const button = this.one("button.resettodefault");
      if (!button) throw new Error("ue-reset-to-default needs a button.resettodefault element");
      this.#sync();
      this.on(button, "click", () => {
        if (this.hasAttribute("differs")) this.emit("ue-reset", {});
      });
    }
    // The idle button keeps its slot but is invisible, disabled and out of the tab order.
    #sync() {
      const button = this.one("button.resettodefault");
      if (!button) return;
      const differs = this.hasAttribute("differs");
      button.classList.toggle("resettodefault--idle", !differs);
      button.disabled = !differs;
    }
  };
  define("ue-reset-to-default", UeResetToDefaultElement);

  // design-system/src/_shared/scroll-thumb.ts
  var MIN_THUMB = 35;
  var BAR_PADDING = 2;
  function thumbLayout(slot, viewport, content, offset) {
    const track = slot - 2 * BAR_PADDING;
    const biased = track - MIN_THUMB;
    const needed = content > viewport + 0.5 && biased > 0;
    if (!needed) return { needed: false, start: BAR_PADDING, size: 0 };
    return {
      needed,
      start: BAR_PADDING + biased * (offset / content),
      size: MIN_THUMB + biased * (viewport / content)
    };
  }
  function offsetForPointer(pointer, grab, slot, content) {
    const biased = slot - 2 * BAR_PADDING - MIN_THUMB;
    const fraction = Math.min(1, Math.max(0, (pointer - BAR_PADDING - grab) / biased));
    return fraction * content;
  }
  function bindBar(view, bar, thumb, vertical, onFits) {
    const slotLength = () => vertical ? bar.clientHeight : bar.clientWidth;
    const viewport = () => vertical ? view.clientHeight : view.clientWidth;
    const content = () => vertical ? view.scrollHeight : view.scrollWidth;
    const offset = () => vertical ? view.scrollTop : view.scrollLeft;
    const scrollTo = (value) => {
      const max = content() - viewport();
      const clamped = Math.min(max, Math.max(0, value));
      if (vertical) view.scrollTop = clamped;
      else view.scrollLeft = clamped;
    };
    const pointerIn = (event) => {
      const box = bar.getBoundingClientRect();
      return vertical ? event.clientY - box.top : event.clientX - box.left;
    };
    const update = () => {
      const fits = !(content() > viewport() + 0.5);
      if (bar.hidden !== fits) {
        bar.hidden = fits;
        onFits?.(fits);
      }
      if (fits) return;
      const layout = thumbLayout(slotLength(), viewport(), content(), offset());
      thumb.style.display = layout.needed ? "" : "none";
      if (!layout.needed) return;
      if (vertical) {
        thumb.style.top = layout.start + "px";
        thumb.style.height = layout.size + "px";
      } else {
        thumb.style.left = layout.start + "px";
        thumb.style.width = layout.size + "px";
      }
    };
    let grab = 0;
    const stopDrag = drag(bar, {
      start: (event) => {
        const box = thumb.getBoundingClientRect();
        const thumbStart = vertical ? box.top : box.left;
        const pointer = vertical ? event.clientY : event.clientX;
        const onThumb = thumb.style.display !== "none" && pointer >= thumbStart && pointer <= thumbStart + (vertical ? box.height : box.width);
        bar.classList.add("is-drag");
        if (thumb.style.display === "none") return;
        grab = onThumb ? pointer - thumbStart : (vertical ? box.height : box.width) / 2;
        if (!onThumb) scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content()));
      },
      move: (event) => scrollTo(offsetForPointer(pointerIn(event), grab, slotLength(), content())),
      end: () => bar.classList.remove("is-drag")
    });
    const onScroll = () => update();
    const onWheel = (event) => {
      event.preventDefault();
      view.scrollBy(vertical ? { top: event.deltaY } : { left: event.deltaX || event.deltaY });
    };
    view.addEventListener("scroll", onScroll);
    bar.addEventListener("wheel", onWheel, { passive: false });
    const observer = new ResizeObserver(update);
    observer.observe(view);
    observer.observe(bar);
    for (const child2 of Array.from(view.children)) observer.observe(child2);
    const mutations = new MutationObserver((records) => {
      for (const record of records) for (const added of Array.from(record.addedNodes)) if (added instanceof Element) observer.observe(added);
      update();
    });
    mutations.observe(view, { childList: true });
    update();
    return {
      update,
      dispose: () => {
        stopDrag();
        view.removeEventListener("scroll", onScroll);
        bar.removeEventListener("wheel", onWheel);
        observer.disconnect();
        mutations.disconnect();
      }
    };
  }

  // design-system/src/Scrollbar/Scrollbar.ts
  var Scrollbar = class extends UeElement {
    #visible = null;
    // True while the content overflows and the bar shows.
    get visible() {
      return this.#visible === true;
    }
    setup() {
      const box = this.all(".sb-scroll").find((candidate) => this.owns(candidate));
      const view = box?.querySelector(":scope > .sb-view");
      const bar = box?.querySelector(":scope > .sb");
      const thumb = bar?.querySelector(".sb-thumb");
      if (!view || !bar || !thumb) throw new Error("ue-scrollbar needs a .sb-scroll with a .sb-view and a .sb bar that holds a .sb-thumb");
      const vertical = !bar.classList.contains("sb-h");
      this.#visible = null;
      let started = false;
      const binding = bindBar(view, bar, thumb, vertical, (fits) => {
        if (started) this.#report(!fits);
      });
      this.onDispose(binding.dispose);
      const first = setTimeout(() => {
        started = true;
        this.#report(!bar.hidden);
      }, 0);
      this.onDispose(() => clearTimeout(first));
    }
    // Announces the first state and every change.
    #report(visible) {
      if (this.#visible === visible) return;
      this.#visible = visible;
      this.emit("ue-scrollbar-visibility", { visible });
    }
  };
  define("ue-scrollbar", Scrollbar);

  // design-system/src/SceneOutliner/SceneOutliner.ts
  var ROW3 = ".so-row";
  var SORTABLE2 = ".hr-cell[aria-sort]";
  var collator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
  var SceneOutliner = class extends UeElement {
    setup() {
      const tree = this.one("ue-tree-row");
      const status = this.one(".so-status");
      const spacer = this.one(".hr-spacer");
      if (!tree || !status) return;
      const rows = () => this.all(ROW3);
      const text = (row, selector) => row.querySelector(selector)?.textContent?.trim() ?? "";
      const label = (row) => text(row, ".tr-text");
      const kind = (row) => text(row, ".so-type");
      const isActor = (row) => kind(row) !== "Folder" && kind(row) !== "World";
      let needle = "";
      const updateStatus = () => {
        const actors = rows().filter(isActor);
        const total = actors.length;
        const selected = actors.filter((row) => row.getAttribute("aria-selected") === "true").length;
        const suffix = selected > 0 ? " (" + selected + " selected)" : "";
        status.classList.remove("is-match", "is-none");
        if (needle === "") {
          status.textContent = total + " actors" + suffix;
          return;
        }
        const shown = actors.filter((row) => label(row).toLowerCase().includes(needle)).length;
        status.classList.add(shown === 0 ? "is-none" : "is-match");
        if (shown === 0) status.textContent = "No matching actors (" + total + " total)";
        else if (shown === total) status.textContent = total + " actors" + suffix;
        else status.textContent = "Showing " + shown + " of " + total + " actors" + suffix;
      };
      this.on(this, "ue-text-input", (event) => {
        needle = event.detail.value.trim().toLowerCase();
        tree.setFilter(needle);
        updateStatus();
      });
      this.on(this, "ue-tree-select", updateStatus);
      this.on(this, "ue-scrollbar-visibility", (event) => {
        if (spacer) spacer.hidden = !event.detail.visible;
      });
      const keys = {};
      const compareBy = (key, a, b) => {
        if (key.column === "type") return key.direction * collator.compare(kind(a.element), kind(b.element));
        const byKind = Number(isActor(a.element)) - Number(isActor(b.element));
        return key.direction * (byKind || collator.compare(a.label, b.label));
      };
      const sortRows = () => {
        const chain = [keys.primary, keys.secondary].filter((key) => key !== void 0);
        tree.sortChildren((a, b) => {
          for (const key of chain) {
            const order = compareBy(key, a, b);
            if (order !== 0) return order;
          }
          return 0;
        });
      };
      const record = (column, mode, priority) => {
        const key = { column, direction: mode === "descending" ? -1 : 1 };
        if (priority === "secondary") keys.secondary = key;
        else keys.primary = key;
        if (priority === "primary" && keys.secondary?.column === column) delete keys.secondary;
      };
      this.on(this, "ue-sort", (event) => {
        const detail = event.detail;
        record(detail.column, detail.mode, detail.priority);
        sortRows();
      });
      for (const cell of this.all(SORTABLE2)) {
        const mode = cell.getAttribute("aria-sort") ?? "none";
        if (mode !== "none") record(cell.dataset.column ?? "label", mode, cell.dataset.priority ?? "primary");
      }
      if (keys.primary || keys.secondary) sortRows();
      this.on(this, "keydown", (event) => {
        const source = event.target;
        if (event.key !== "ArrowDown" || !(source instanceof HTMLElement) || !source.matches(".textinput__field")) return;
        const shown = rows().filter((row) => !row.hidden);
        const current = shown.find((row) => row.tabIndex === 0) ?? shown[0];
        if (!current) return;
        event.preventDefault();
        current.focus({ preventScroll: true });
        current.scrollIntoView({ block: "nearest" });
      });
      this.on(this, "click", (event) => {
        const source = event.target;
        if (!(source instanceof Element) || !source.closest(".so-gutter")) return;
        const row = source.closest(ROW3);
        if (!row) return;
        const all = rows();
        const level = (r) => Number(r.getAttribute("aria-level"));
        const start = all.indexOf(row);
        const hide = !row.querySelector(".so-eye")?.classList.contains("is-off");
        for (let i = start; i < all.length && (i === start || level(all[i]) > level(row)); i++) {
          const eye = all[i].querySelector(".so-eye");
          if (!eye) continue;
          eye.classList.toggle("is-off", hide);
          eye.querySelector("use")?.setAttribute("href", hide ? "#so-eye-off" : "#so-eye");
        }
      });
      updateStatus();
    }
  };
  define("ue-scene-outliner", SceneOutliner);

  // design-system/src/Slider/Slider.ts
  var HANDLE = 8;
  function attr(el, name, fallback) {
    const raw = el.dataset[name];
    const value = raw === void 0 ? NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }
  var UeSliderElement = class extends UeElement {
    #dragging = /* @__PURE__ */ new WeakSet();
    setup() {
      const slider = this.one('.slider[role="slider"]');
      if (!slider) throw new Error('ue-slider needs a .slider[role="slider"] element');
      this.#render(slider);
      this.on(slider, "pointerdown", (event) => {
        if (event.button !== 0 || slider.getAttribute("aria-disabled") === "true") return;
        slider.setPointerCapture(event.pointerId);
        this.#dragging.add(slider);
        slider.focus();
        this.#fromPointer(slider, event.clientX);
        event.preventDefault();
      });
      this.on(slider, "pointermove", (event) => {
        if (this.#dragging.has(slider)) this.#fromPointer(slider, event.clientX);
      });
      const release = (event) => {
        this.#dragging.delete(slider);
        if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
      };
      this.on(slider, "pointerup", release);
      this.on(slider, "pointercancel", release);
      this.on(slider, "keydown", (event) => {
        if (slider.getAttribute("aria-disabled") === "true") return;
        const min = attr(slider, "min", 0);
        const max = attr(slider, "max", 1);
        const step = attr(slider, "step", (max - min) / 100);
        const value = attr(slider, "value", min);
        let next;
        switch (event.key) {
          case "ArrowRight":
          case "ArrowUp":
            next = value + step;
            break;
          case "ArrowLeft":
          case "ArrowDown":
            next = value - step;
            break;
          case "PageUp":
            next = value + step * 10;
            break;
          case "PageDown":
            next = value - step * 10;
            break;
          case "Home":
            next = min;
            break;
          case "End":
            next = max;
            break;
          default:
            return;
        }
        event.preventDefault();
        this.#set(slider, next);
      });
    }
    // The thumb centre runs from HANDLE to width minus HANDLE, SSlider.cpp:84-91.
    #fromPointer(slider, clientX) {
      const rect = slider.getBoundingClientRect();
      const travel = rect.width - 2 * HANDLE;
      const fraction = travel <= 0 ? 0 : (clientX - rect.left - HANDLE) / travel;
      const min = attr(slider, "min", 0);
      const max = attr(slider, "max", 1);
      this.#set(slider, min + Math.min(1, Math.max(0, fraction)) * (max - min));
    }
    #set(slider, raw) {
      const min = attr(slider, "min", 0);
      const max = attr(slider, "max", 1);
      const step = attr(slider, "step", 0);
      let value = Math.min(max, Math.max(min, raw));
      if (step > 0) value = Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
      value = Math.round(value * 1e6) / 1e6;
      const changed = value !== attr(slider, "value", min);
      slider.dataset.value = String(value);
      this.#render(slider);
      if (changed) this.emit("ue-slider-change", { value, text: step > 0 && step < 1 ? value.toFixed(2) : String(value) });
    }
    #render(slider) {
      const min = attr(slider, "min", 0);
      const max = attr(slider, "max", 1);
      const value = attr(slider, "value", min);
      slider.setAttribute("aria-valuemin", String(min));
      slider.setAttribute("aria-valuemax", String(max));
      slider.setAttribute("aria-valuenow", String(value));
      slider.style.setProperty("--slider-value", String(max === min ? 0 : (value - min) / (max - min)));
    }
  };
  define("ue-slider", UeSliderElement);

  // design-system/src/SpinBox/SpinBox.ts
  var DRAG_TRIGGER = 5;
  var MIN_SLIDER_WIDTH = 100;
  function numberAttr(el, name) {
    const raw = el.dataset[name];
    if (raw === void 0 || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
  function rangeOf(box) {
    const min = numberAttr(box, "min");
    const max = numberAttr(box, "max");
    return { min: min ?? -Infinity, max: max ?? Infinity, bounded: min !== null && max !== null, delta: numberAttr(box, "delta") ?? numberAttr(box, "step") ?? 0 };
  }
  function valueOf(box) {
    return numberAttr(box, "value") ?? 0;
  }
  function format(value) {
    const rounded = Math.round(value * 1e3) / 1e3;
    return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
  }
  function clamp(value, range) {
    return Math.min(range.max, Math.max(range.min, value));
  }
  var UeSpinBoxElement = class extends UeElement {
    #drags = /* @__PURE__ */ new WeakMap();
    setup() {
      const box = this.one(".spinbox");
      if (!box) throw new Error("ue-spin-box needs a .spinbox element");
      this.#render(box);
      this.on(box, "pointerdown", (event) => {
        if (event.button !== 0 || box.getAttribute("aria-disabled") === "true") return;
        if (box.classList.contains("spinbox--text")) return;
        box.setPointerCapture(event.pointerId);
        this.#drags.set(box, { pointerId: event.pointerId, lastX: event.clientX, distance: 0, dragging: false, before: valueOf(box), internal: valueOf(box) });
        box.focus();
        event.preventDefault();
      });
      this.on(box, "pointermove", (event) => {
        const state = this.#drags.get(box);
        if (!state || state.pointerId !== event.pointerId) return;
        const dx = event.clientX - state.lastX;
        state.lastX = event.clientX;
        if (!state.dragging) {
          state.distance += Math.abs(dx);
          if (state.distance > DRAG_TRIGGER) {
            state.dragging = true;
            box.classList.add("spinbox--active");
          }
          return;
        }
        this.#drag(box, state, dx);
      });
      const finish = (event) => {
        const state = this.#drags.get(box);
        if (!state || state.pointerId !== event.pointerId) return;
        this.#drags.delete(box);
        if (box.hasPointerCapture(event.pointerId)) box.releasePointerCapture(event.pointerId);
        box.classList.remove("spinbox--active");
        if (event.type === "pointercancel") return;
        if (state.dragging) {
          const range = rangeOf(box);
          if (range.delta > 0) this.#set(box, clamp(Math.round(valueOf(box) / range.delta) * range.delta, range));
        } else {
          this.#enterText(box);
        }
      };
      this.on(box, "pointerup", finish);
      this.on(box, "pointercancel", finish);
      this.on(box, "keydown", (event) => {
        if (box.getAttribute("aria-disabled") === "true") return;
        const state = this.#drags.get(box);
        if (event.key === "Escape" && state?.dragging) {
          this.#drags.delete(box);
          if (box.hasPointerCapture(state.pointerId)) box.releasePointerCapture(state.pointerId);
          box.classList.remove("spinbox--active");
          this.#set(box, state.before);
          event.preventDefault();
          return;
        }
        if (event.target !== box) return;
        const range = rangeOf(box);
        if (event.key === "ArrowUp" || event.key === "ArrowRight") this.#set(box, clamp(valueOf(box) + range.delta, range));
        else if (event.key === "ArrowDown" || event.key === "ArrowLeft") this.#set(box, clamp(valueOf(box) - range.delta, range));
        else if (event.key === "Enter") this.#enterText(box);
        else return;
        event.preventDefault();
      });
      this.on(box, "focusout", (event) => {
        if (event.target instanceof HTMLInputElement && event.target.classList.contains("spinbox__field")) this.#exitText(box, true, false);
      });
    }
    // The value change of one mouse move while dragging, from SSpinBox::OnMouseMove.
    #drag(box, state, dx) {
      const range = rangeOf(box);
      const width = Math.max(box.getBoundingClientRect().width, MIN_SLIDER_WIDTH);
      let next;
      if (range.bounded) {
        const step = range.max - range.min <= 10 ? 0.1 : 1;
        const filled = Math.min(width, Math.max(0, (state.internal - range.min) / (range.max - range.min) * width + dx * step));
        next = range.min + filled / width * (range.max - range.min);
      } else {
        const sign = dx > 0 ? 1 : -1;
        next = state.internal + sign * (Math.abs(dx) / width) * Math.max(Math.abs(state.internal), 1);
      }
      state.internal = clamp(next, range);
      this.#set(box, state.internal);
    }
    #set(box, value) {
      const before = valueOf(box);
      box.dataset.value = String(value);
      this.#render(box);
      if (value !== before) this.emit("ue-spin-change", { value, text: format(value) + (box.dataset.unit ? " " + box.dataset.unit : "") });
    }
    #render(box) {
      const range = rangeOf(box);
      const value = valueOf(box);
      box.setAttribute("aria-valuenow", String(value));
      if (range.bounded) {
        box.setAttribute("aria-valuemin", String(range.min));
        box.setAttribute("aria-valuemax", String(range.max));
        box.style.setProperty("--spinbox-fill", String((value - range.min) / (range.max - range.min)));
      }
      box.classList.toggle("spinbox--unbounded", !range.bounded);
      const text = box.querySelector(".spinbox__text");
      if (text && !box.classList.contains("spinbox--text")) text.textContent = format(value);
      const unit = box.dataset.unit;
      let suffix = box.querySelector(".spinbox__unit");
      if (unit && !suffix && text) {
        suffix = document.createElement("span");
        suffix.className = "spinbox__unit";
        text.after(suffix);
      }
      if (suffix) suffix.textContent = unit ?? "";
    }
    #enterText(box) {
      const text = box.querySelector(".spinbox__text");
      if (!text) return;
      box.classList.add("spinbox--text");
      const field = document.createElement("input");
      field.className = "spinbox__field";
      field.type = "text";
      field.value = format(valueOf(box));
      field.setAttribute("aria-label", "Value");
      text.replaceChildren(field);
      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.#exitText(box, true, true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          this.#exitText(box, false, true);
        }
      });
      field.focus();
      field.select();
    }
    #exitText(box, commit, refocus) {
      const field = box.querySelector(".spinbox__field");
      if (!field || !box.classList.contains("spinbox--text")) return;
      const typed = Number(field.value.trim());
      box.classList.remove("spinbox--text");
      const range = rangeOf(box);
      if (commit && field.value.trim() !== "" && Number.isFinite(typed)) this.#set(box, clamp(typed, range));
      else this.#render(box);
      if (refocus) box.focus();
    }
  };
  define("ue-spin-box", UeSpinBoxElement);

  // design-system/src/StatusBar/StatusBar.ts
  var DRAWER = ".statusBar-seg--drawer .button";
  var MAX_LINES = 4;
  var StatusBar = class extends UeElement {
    setup() {
      const field = this.one(".statusBar-console .textinput__field");
      const history = this.one(".statusBar-history");
      const recalled = [];
      let recallIndex = 0;
      const run = (command) => {
        if (history) {
          const line = document.createElement("div");
          line.className = "statusBar-history-line";
          line.textContent = "> " + command;
          history.append(line);
          while (history.children.length > MAX_LINES) history.firstElementChild?.remove();
        }
        recalled.push(command);
        recallIndex = recalled.length;
        this.emit("ue-command", { command });
      };
      this.on(this, "ue-button-click", (event) => {
        const button = event.target instanceof Element ? event.target.querySelector(".button") : null;
        if (!button?.closest(".statusBar-seg--drawer")) return;
        const detail = event.detail;
        for (const other of this.all(DRAWER)) {
          if (other !== button) other.setAttribute("aria-pressed", "false");
        }
        this.emit("ue-drawer-change", { drawer: detail.pressed ? detail.label : null });
      });
      this.on(this, "ue-combo-pick", (event) => {
        if (!(event.target instanceof Element) || !event.target.closest(".statusBar-console")) return;
        this.emit("ue-executor-change", { executor: event.detail.label });
      });
      if (!field) return;
      this.on(field, "keydown", (event) => {
        if (event.key === "Enter") {
          const command = field.value.trim();
          event.preventDefault();
          if (command === "") return;
          run(command);
          field.value = "";
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          recallIndex = Math.min(Math.max(recallIndex + (event.key === "ArrowUp" ? -1 : 1), 0), recalled.length);
          field.value = recalled[recallIndex] ?? "";
        }
      });
    }
  };
  define("ue-status-bar", StatusBar);

  // design-system/src/TabWell/TabWell.ts
  var TabWellElement = class extends TabStackElement {
    names = {
      stack: "tabWell-stack",
      well: "tabWell-well",
      tab: "tabWell-tab",
      label: "tabWell-label",
      close: "tabWell-close",
      reset: "tabWell-reset",
      foreground: "tabWell-tab--foreground",
      active: "tabWell-tab--active"
    };
  };
  define("ue-tab-well", TabWellElement);

  // design-system/src/ToolBar/ToolBar.ts
  var CONTROL = ".button, .combobutton";
  var PANEL2 = ".combobutton-menu";
  function isDisabled3(el) {
    return el.matches(":disabled") || el.getAttribute("aria-disabled") === "true";
  }
  var ToolBar = class extends UeElement {
    setup() {
      const buttonIn = (bar, plate) => bar.querySelector(plate + " .button");
      const setPlaying = (bar, playing) => {
        const play = buttonIn(bar, ".toolBar-plate--play");
        const stop = buttonIn(bar, ".toolBar-plate--stop");
        if (!play || !stop) return;
        play.setAttribute("aria-pressed", String(playing));
        stop.disabled = !playing;
        if (bar instanceof HTMLElement) bar.dataset.playing = String(playing);
        this.emit("ue-play-change", { playing });
      };
      for (const stop of this.all(".toolBar-plate--stop")) {
        const bar = stop.closest(".toolBar");
        if (bar) setPlaying(bar, bar.getAttribute("data-playing") === "true");
      }
      this.on(this, "ue-button-click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const bar = target.closest(".toolBar");
        if (!bar) return;
        if (target.closest(".toolBar-plate--play")) {
          if (bar.getAttribute("data-playing") !== "true") setPlaying(bar, true);
          else buttonIn(bar, ".toolBar-plate--play")?.setAttribute("aria-pressed", "true");
        } else if (target.closest(".toolBar-plate--stop")) {
          setPlaying(bar, false);
        }
      });
      this.on(this, "ue-combo-pick", (event) => {
        this.emit("ue-menu-select", { label: event.detail.label });
      });
      this.on(this, "keydown", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        const control = target.closest(CONTROL);
        const bar = control?.closest(".toolBar");
        if (!control || !bar || control.closest(PANEL2)) return;
        const list = Array.from(bar.querySelectorAll(CONTROL)).filter((c) => !c.closest(PANEL2) && !isDisabled3(c));
        const next = list[(list.indexOf(control) + (event.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
        event.preventDefault();
        next.focus();
      });
    }
  };
  define("ue-tool-bar", ToolBar);

  // design-system/src/Tooltip/Tooltip.ts
  var SUMMON_DELAY = 150;
  var INTRO = 100;
  var OFFSET_X = 12;
  var OFFSET_Y = 8;
  var EDGE = 4;
  var UeTooltipElement = class extends UeElement {
    #active = null;
    #suppressed = false;
    #frame = 0;
    #popup = null;
    setup() {
      const popup = this.all(".tooltip-popup").find((candidate) => ownedBy(this, candidate));
      if (!popup) throw new Error("ue-tooltip needs a .tooltip-popup element");
      this.#popup = popup;
      const inTarget = (node) => ownedBy(this, node) && !popup.contains(node);
      this.on(this, "pointerover", (event) => {
        if (!inTarget(event.target) || this.#suppressed || this.#active) return;
        this.#summon(event.clientX, event.clientY);
      });
      this.on(this, "pointermove", (event) => {
        if (inTarget(event.target) && this.#active && this.#active.start >= 0) {
          this.#active.x = event.clientX;
          this.#active.y = event.clientY;
        }
      });
      this.on(this, "pointerout", (event) => {
        if (!inTarget(event.target)) return;
        if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
        this.#suppressed = false;
        this.#dismiss();
      });
      this.on(this, "pointerdown", (event) => {
        if (!inTarget(event.target)) return;
        this.#suppressed = true;
        this.#dismiss();
      });
      this.on(this, "focusin", (event) => {
        const target = event.target;
        if (!inTarget(target) || !target.matches(":focus-visible") || this.#active) return;
        const rect = target.getBoundingClientRect();
        this.#summon(rect.left, rect.bottom - OFFSET_Y);
      });
      this.on(this, "focusout", (event) => {
        if (inTarget(event.target)) this.#dismiss();
      });
      this.on(document, "keydown", (event) => {
        if (event.key === "Escape") this.#dismiss();
      });
      this.onDispose(() => this.#dismiss());
    }
    #summon(x, y) {
      this.#dismiss();
      const popup = this.#popup;
      if (!popup) return;
      this.#active = { popup, start: performance.now(), x, y };
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

  // design-system/src/VectorInput/VectorInput.ts
  var round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;
  function format2(value, unit) {
    let text = String(round(value, 4));
    if (!text.includes(".")) text += ".0";
    return unit === "" ? text : text + " " + unit;
  }
  var UeVectorInput = class extends UeElement {
    setup() {
      for (const row of this.all(".VectorInput-row")) this.wireRow(row);
    }
    wireRow(row) {
      const fields = Array.from(row.querySelectorAll(".VectorInput-field"));
      if (fields.length === 0) return;
      const reset = row.querySelector(".VectorInput-reset");
      const lock = row.querySelector(".VectorInput-lock");
      const unit = row.dataset.unit ?? "";
      const step = Number(row.dataset.step ?? "1");
      const defaults = (row.dataset.default ?? "").split(",").map(Number);
      const read = () => fields.map((field) => Number(field.dataset.value));
      const isLocked = () => lock?.classList.contains("is-locked") ?? false;
      const isEditing = (field) => field.classList.contains("is-editing");
      const write = (values, notify) => {
        fields.forEach((field, i) => {
          field.dataset.value = String(values[i]);
          field.setAttribute("aria-valuenow", String(values[i]));
          const text = field.querySelector(".VectorInput-value-text");
          if (text && !isEditing(field)) text.textContent = format2(values[i], unit);
        });
        const differs = values.some((value, i) => Math.abs(value - defaults[i]) > 1e-9);
        reset?.classList.toggle("is-placeholder", !differs);
        if (reset) reset.tabIndex = differs ? 0 : -1;
        if (notify) this.emit("ue-vector-change", { values });
      };
      const change = (values, index, next, basis) => {
        const out = values.slice();
        out[index] = next;
        if (!isLocked()) return out;
        for (let j = 0; j < out.length; j++) {
          if (j !== index) out[j] = basis[index] === 0 ? next : basis[j] * next / basis[index];
        }
        return out;
      };
      fields.forEach((field, index) => this.wireField(field, index, { read, write, change, isEditing, step, unit }));
      if (reset) this.on(reset, "click", () => write(defaults, true));
      if (lock) {
        this.on(lock, "click", () => {
          const on = !isLocked();
          lock.classList.toggle("is-locked", on);
          lock.setAttribute("aria-pressed", String(on));
          lock.title = on ? "Scale uniformly (locked)" : "Scale uniformly (unlocked)";
          lock.querySelector("use")?.setAttribute("href", on ? "#VectorInput-locked" : "#VectorInput-unlock");
        });
      }
      const combo = row.querySelector(".VectorInput-combo");
      const menu = row.querySelector(".VectorInput-menu");
      if (combo && menu) {
        const handle = wireMenu({
          trigger: combo,
          menu,
          itemSelector: ".VectorInput-menuItem",
          onPick: (item) => {
            for (const other of menu.querySelectorAll(".VectorInput-menuItem")) other.setAttribute("aria-checked", String(other === item));
            this.emit("ue-vector-space", { space: (item.textContent ?? "").trim() });
          }
        });
        this.onDispose(handle.dispose);
      }
      write(read(), false);
    }
    wireField(field, index, row) {
      const text = field.querySelector(".VectorInput-value-text");
      if (!text) return;
      let startValues = [];
      let live = 0;
      let lastX = 0;
      let dragging = false;
      let cancelled = false;
      const leaveEdit = () => {
        field.classList.remove("is-editing", "is-active");
        text.contentEditable = "false";
      };
      const enterEdit = () => {
        field.classList.add("is-editing", "is-active");
        text.contentEditable = "plaintext-only";
        text.textContent = String(round(row.read()[index], 4));
        text.focus();
        const selection = window.getSelection();
        selection?.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(text);
        selection?.addRange(range);
      };
      const commit = (refocus) => {
        const raw = (text.textContent ?? "").replace(/[^0-9eE+.-]/g, "");
        const next = Number(raw);
        leaveEdit();
        const values = row.read();
        row.write(raw === "" || Number.isNaN(next) ? values : row.change(values, index, next, values), true);
        if (refocus) field.focus();
      };
      const cancelEdit = () => {
        leaveEdit();
        row.write(row.read(), false);
        field.focus();
      };
      this.onDispose(
        drag(field, {
          start: (event) => {
            if (row.isEditing(field)) return;
            startValues = row.read();
            live = startValues[index];
            lastX = event.clientX;
            dragging = false;
            cancelled = false;
          },
          move: (event) => {
            if (row.isEditing(field) || cancelled) return;
            if (!dragging) {
              dragging = true;
              lastX = event.clientX;
              field.classList.add("is-active");
              return;
            }
            const dx = event.clientX - lastX;
            lastX = event.clientX;
            const width = Math.max(field.getBoundingClientRect().width, 100);
            live += Math.sign(dx) * (Math.abs(dx) / width) * Math.max(Math.abs(live), 1);
            row.write(row.change(row.read(), index, live, startValues), false);
          },
          end: () => {
            if (row.isEditing(field)) return;
            if (!dragging) {
              enterEdit();
              return;
            }
            dragging = false;
            field.classList.remove("is-active");
            if (cancelled) return;
            const snapped = round(Math.round(live / row.step) * row.step, 6);
            row.write(row.change(row.read(), index, snapped, startValues), true);
          }
        })
      );
      this.on(document, "keydown", (event) => {
        if (event.key !== "Escape" || !dragging || cancelled) return;
        cancelled = true;
        field.classList.remove("is-active");
        row.write(startValues, true);
      });
      this.on(field, "keydown", (event) => {
        if (row.isEditing(field)) return;
        let sign = 0;
        if (event.key === "ArrowUp" || event.key === "ArrowRight") sign = 1;
        else if (event.key === "ArrowDown" || event.key === "ArrowLeft") sign = -1;
        else if (event.key === "Enter") {
          event.preventDefault();
          enterEdit();
          return;
        }
        if (sign === 0) return;
        event.preventDefault();
        const values = row.read();
        row.write(row.change(values, index, round(values[index] + sign * row.step, 6), values), true);
      });
      this.on(text, "keydown", (event) => {
        if (event.key === "Enter") commit(true);
        else if (event.key === "Escape") cancelEdit();
        else {
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      });
      this.on(text, "blur", () => {
        if (row.isEditing(field)) commit(false);
      });
    }
  };
  define("ue-vector-input", UeVectorInput);

  // design-system/src/WindowChrome/WindowChrome.ts
  var MAXIMIZE_GLYPH = "#windowChrome-i-max";
  var RESTORE_GLYPH = "#windowChrome-i-restore";
  var WindowChromeElement = class extends UeElement {
    setup() {
      const frame = this.one(".windowChrome-frame");
      if (!frame) throw new Error("ue-window-chrome needs a .windowChrome-frame child");
      const status = this.one(".windowChrome-status");
      const reopenHost = this.one(".windowChrome-reopen");
      const reopen = reopenHost?.querySelector(".button") ?? null;
      const setActive = (active) => {
        frame.dataset.active = String(active);
        if (status) status.textContent = active ? "Window active" : "Window inactive";
      };
      setActive(frame.contains(document.activeElement));
      this.on(this, "focusin", () => setActive(frame.contains(document.activeElement)));
      this.on(this, "focusout", (event) => setActive(event.relatedTarget instanceof Node && frame.contains(event.relatedTarget)));
      const hideWindow = (label) => {
        frame.hidden = true;
        if (!reopenHost || !reopen) return;
        reopen.textContent = label;
        reopenHost.hidden = false;
        reopen.focus();
      };
      const toggleMaximized = (button) => {
        const maximized = frame.toggleAttribute("data-maximized");
        button.querySelector("use")?.setAttribute("href", maximized ? RESTORE_GLYPH : MAXIMIZE_GLYPH);
        const label = maximized ? "Restore Down" : "Maximize";
        button.setAttribute("aria-label", label);
        button.title = label;
      };
      this.on(this, "click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest(".windowChrome-reopen")) {
          frame.hidden = false;
          if (reopenHost) reopenHost.hidden = true;
          frame.focus();
          return;
        }
        const button = target?.closest(".button[data-action]");
        if (!button || !frame.contains(button)) return;
        const action = button.dataset.action;
        if (action === "minimize") hideWindow("Window minimized: restore");
        else if (action === "maximize") toggleMaximized(button);
        else if (action === "close") hideWindow("Window closed: reopen");
      });
    }
  };
  define("ue-window-chrome", WindowChromeElement);

  // design-system/bundle/main.ts
  window.UEStarship = {
    elements: Array.from(new Set(Array.from(document.querySelectorAll("*")).map((el) => el.localName).filter((tag) => tag.startsWith("ue-"))))
  };
})();
