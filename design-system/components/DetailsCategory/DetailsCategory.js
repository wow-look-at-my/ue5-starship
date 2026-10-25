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

// src/_shared/popupmenu.ts
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
    const start = list.find((item) => item.getAttribute("aria-checked") === "true") ?? list[0];
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

// src/DetailsCategory/DetailsCategory.ts
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
