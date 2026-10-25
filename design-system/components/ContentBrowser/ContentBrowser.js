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

// design-system/src/_shared/contentMenu.ts
var TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
function openMenu(host, anchor, options) {
  const menu = document.createElement("div");
  menu.className = options.prefix + "__menu";
  menu.setAttribute("role", "menu");
  const items = [];
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    document.removeEventListener("pointerdown", outside, true);
    menu.remove();
    anchor.setAttribute("aria-expanded", "false");
    options.onClose?.();
  };
  const outside = (event) => {
    const target = event.target;
    if (target instanceof Node && !menu.contains(target) && !anchor.contains(target)) close();
  };
  options.entries.forEach((entry, index) => {
    if (entry.separator) {
      const rule = document.createElement("div");
      rule.className = options.prefix + "__menusep";
      rule.setAttribute("role", "separator");
      menu.append(rule);
      return;
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = options.prefix + "__menuitem";
    item.tabIndex = -1;
    item.disabled = entry.disabled === true;
    if (entry.checkable) {
      item.setAttribute("role", "menuitemcheckbox");
      item.setAttribute("aria-checked", String(entry.checked === true));
    } else {
      item.setAttribute("role", "menuitem");
    }
    const check = document.createElement("span");
    check.className = options.prefix + "__menucheck";
    if (entry.checked) check.innerHTML = TICK;
    const label = document.createElement("span");
    label.textContent = entry.label ?? "";
    item.append(check, label);
    item.addEventListener("click", () => {
      close();
      anchor.focus();
      options.onPick(index);
    });
    items.push(item);
    menu.append(item);
  });
  menu.addEventListener("keydown", (event) => {
    const enabled = items.filter((item) => !item.disabled);
    const at = enabled.indexOf(document.activeElement);
    let next;
    if (event.key === "ArrowDown") next = enabled[(at + 1) % enabled.length];
    else if (event.key === "ArrowUp") next = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      anchor.focus();
      return;
    } else if (event.key === "Tab") {
      close();
      return;
    } else return;
    event.preventDefault();
    next?.focus();
  });
  host.append(menu);
  const hostBox = host.getBoundingClientRect();
  const anchorBox = anchor.getBoundingClientRect();
  let left = anchorBox.left - hostBox.left;
  if (left + menu.offsetWidth > hostBox.width) left = Math.max(0, anchorBox.right - hostBox.left - menu.offsetWidth);
  menu.style.left = left + "px";
  menu.style.top = anchorBox.bottom - hostBox.top + "px";
  anchor.setAttribute("aria-expanded", "true");
  document.addEventListener("pointerdown", outside, true);
  items.find((item) => !item.disabled)?.focus();
  return { element: menu, anchor, close };
}

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

// design-system/src/ContentBrowser/ContentBrowser.ts
var PREFIX = "ContentBrowser";
var INDENT_PX = 10;
var MIN_SOURCES = 120;
var MIN_ASSETS = 200;
var HANDLE_PX = 2;
var CHEVRON = '<span class="ContentBrowser__delim"><svg><use href="#cb-chev-r"/></svg></span>';
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
var ADD_ENTRIES = [
  { label: "Import to Current Folder" },
  { separator: true },
  { label: "New Folder" },
  { label: "Blueprint Class" },
  { label: "Level" },
  { label: "Material" }
];
var SETTINGS_DEFAULTS = [
  ["Show Folders", true],
  ["Show Empty Folders", false],
  ["Show Favorites", false],
  ["Show Developers Content", false],
  ["Show Engine Content", false],
  ["Show Plugin Content", true]
];
function child(parent, name) {
  const folder = { name, parent, kids: [] };
  parent.kids.push(folder);
  return folder;
}
function buildModel() {
  const all = { name: "All", parent: null, kids: [] };
  const content = child(all, "Content");
  const start = child(content, "StarterContent");
  for (const [name, kids] of STARTER) {
    const folder = child(start, name);
    for (const kid of kids) child(folder, kid);
  }
  return { all, start };
}
function pathOf(folder) {
  const path = [];
  for (let at = folder; at; at = at.parent) path.unshift(at);
  return path;
}
function escape(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
var ContentBrowserElement = class extends UeElement {
  #root;
  #top;
  #body;
  #sources;
  #split;
  #tree;
  #tiles;
  #status;
  #input;
  #all;
  #cur;
  #open = /* @__PURE__ */ new Set();
  #history = [];
  #index = 0;
  #picked = /* @__PURE__ */ new Set();
  #anchor = null;
  #rowFolder = /* @__PURE__ */ new WeakMap();
  #tileFolder = /* @__PURE__ */ new WeakMap();
  #menu = null;
  #checks = /* @__PURE__ */ new Map();
  setup() {
    this.#root = this.#need(".ContentBrowser");
    this.#top = this.#need(".ContentBrowser__top");
    this.#body = this.#need(".ContentBrowser__body");
    this.#sources = this.#need(".ContentBrowser__sources");
    this.#split = this.#need(".ContentBrowser__split");
    this.#tree = this.#need(".ContentBrowser__tree[data-folders]");
    this.#tiles = this.#need(".ContentBrowser__tiles");
    this.#status = this.#need(".ContentBrowser__status");
    this.#input = this.#need(".ContentBrowser__input");
    const keptNames = this.all(".ContentBrowser__tile.is-sel .ContentBrowser__label div").map((label) => (label.textContent ?? "").trim());
    const model = buildModel();
    this.#all = model.all;
    this.#cur = model.start;
    this.#open = new Set(pathOf(model.start));
    this.#history = [model.start.parent ?? model.start, model.start];
    this.#index = 1;
    this.#picked = new Set(model.start.kids.filter((folder) => keptNames.includes(folder.name)));
    this.#anchor = null;
    this.#menu = null;
    this.#checks = new Map(SETTINGS_DEFAULTS);
    for (const title of this.all(".ContentBrowser__title")) {
      const area = title.closest(".ContentBrowser__area");
      const body = area?.querySelector(".ContentBrowser__tree");
      title.setAttribute("role", "button");
      title.tabIndex = 0;
      title.setAttribute("aria-expanded", String(body ? !body.hidden : false));
    }
    for (const control of this.all(".ContentBrowser__tool")) {
      control.setAttribute("role", "button");
      control.tabIndex = 0;
      control.setAttribute("aria-pressed", "false");
    }
    this.#tree.setAttribute("role", "tree");
    this.#tiles.setAttribute("role", "listbox");
    this.#tiles.setAttribute("aria-multiselectable", "true");
    this.#split.setAttribute("role", "separator");
    this.#split.setAttribute("aria-orientation", "vertical");
    this.#split.tabIndex = 0;
    this.#setSourcesWidth(this.#sources.offsetWidth);
    this.#render();
    this.on(this.#root, "click", (event) => this.#click(event));
    this.on(this.#root, "dblclick", (event) => {
      const folder = this.#folderOfTile(event.target);
      if (folder) this.#go(folder);
    });
    this.on(this.#root, "keydown", (event) => this.#keydown(event));
    this.on(this.#input, "input", () => this.#renderTiles());
    let startWidth = 0;
    this.onDispose(
      drag(this.#split, {
        start: () => {
          startWidth = this.#sources.offsetWidth;
          this.#split.classList.add("is-dragging");
        },
        move: (_event, dx) => this.#setSourcesWidth(startWidth + dx),
        end: () => this.#split.classList.remove("is-dragging")
      })
    );
    this.onDispose(() => this.#menu?.close());
  }
  #need(selector) {
    const found = this.one(selector);
    if (!found) throw new Error("ue-content-browser needs " + selector);
    return found;
  }
  // ---- navigation ----
  #go(folder) {
    if (folder === this.#cur) return;
    this.#history = this.#history.slice(0, this.#index + 1);
    this.#history.push(folder);
    this.#index = this.#history.length - 1;
    this.#show(folder);
  }
  #walk(delta) {
    const next = this.#index + delta;
    if (next < 0 || next >= this.#history.length) return;
    const hadFocus = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains("ContentBrowser__nav");
    this.#index = next;
    this.#show(this.#history[next]);
    if (hadFocus) {
      const own = this.one(delta < 0 ? ".ContentBrowser__nav--back" : ".ContentBrowser__nav--fwd");
      const other = this.one(delta < 0 ? ".ContentBrowser__nav--fwd" : ".ContentBrowser__nav--back");
      (own && !own.disabled ? own : other)?.focus();
    }
  }
  #show(folder) {
    for (let at = folder.parent; at; at = at.parent) this.#open.add(at);
    this.#cur = folder;
    this.#picked.clear();
    this.#anchor = null;
    this.#input.value = "";
    this.#render();
    this.emit("contentbrowser:navigate", { path: pathOf(folder).map((each) => each.name) });
  }
  #toggleOpen(folder) {
    if (this.#open.has(folder)) {
      this.#open.delete(folder);
      if (pathOf(this.#cur).includes(folder) && this.#cur !== folder) {
        this.#go(folder);
        return;
      }
    } else {
      this.#open.add(folder);
    }
    this.#render();
  }
  // ---- rendering ----
  #render() {
    const active = document.activeElement;
    const rowFolder = active ? this.#rowFolder.get(active) : void 0;
    const tileFolder = active ? this.#tileFolder.get(active) : void 0;
    this.#input.placeholder = "Search " + this.#cur.name;
    this.#renderCrumbs();
    this.#renderNav();
    this.#renderTree();
    this.#renderTiles();
    if (rowFolder) this.#rowOf(rowFolder)?.focus();
    else if (tileFolder) this.#tileOf(tileFolder)?.focus();
  }
  #renderCrumbs() {
    const path = this.#need(".ContentBrowser__path");
    for (const old of this.all(".ContentBrowser__crumb, .ContentBrowser__delim")) old.remove();
    for (const folder of pathOf(this.#cur)) path.insertAdjacentHTML("beforeend", '<button class="ContentBrowser__crumb">' + escape(folder.name) + "</button>" + CHEVRON);
  }
  #renderNav() {
    const back = this.one(".ContentBrowser__nav--back");
    const fwd = this.one(".ContentBrowser__nav--fwd");
    if (back) back.disabled = this.#index === 0;
    if (fwd) fwd.disabled = this.#index >= this.#history.length - 1;
  }
  #renderTree() {
    const lines = [];
    const folders = [];
    const parents = new Set(pathOf(this.#cur).slice(0, -1));
    const walk = (folder, depth) => {
      const kids = folder.kids.length > 0;
      const open = kids && this.#open.has(folder);
      const classes = ["ContentBrowser__row"];
      if (parents.has(folder)) classes.push("ContentBrowser__row--parent");
      if (depth === 0) classes.push("ContentBrowser__row--root");
      const selected = folder === this.#cur;
      if (selected) classes.push("ContentBrowser__row--sel");
      const expanded = kids ? ' aria-expanded="' + open + '"' : "";
      const style = depth > 0 ? ' style="padding-left:' + depth * INDENT_PX + 'px"' : "";
      const caret = kids ? '<svg><use href="#cb-' + (open ? "cd" : "cr") + '"/></svg>' : "";
      lines.push(
        '<div class="' + classes.join(" ") + '" role="treeitem" aria-level="' + (depth + 1) + '" aria-selected="' + selected + '"' + expanded + ' tabindex="' + (selected ? 0 : -1) + '"' + style + '><span class="ContentBrowser__exp">' + caret + '</span><svg class="ContentBrowser__fi"><use href="#cb-' + (open ? "fo" : "fc") + '"/></svg><span class="ContentBrowser__name">' + escape(folder.name) + "</span></div>"
      );
      folders.push(folder);
      if (open) for (const kid of folder.kids) walk(kid, depth + 1);
    };
    walk(this.#all, 0);
    this.#tree.innerHTML = lines.join("");
    this.#tree.querySelectorAll(".ContentBrowser__row").forEach((row, i) => this.#rowFolder.set(row, folders[i]));
    this.#revealSelected();
  }
  // Scrolls only the tree, never the page.
  #revealSelected() {
    const row = this.#tree.querySelector(".ContentBrowser__row--sel");
    if (!row || this.#tree.hidden) return;
    const area = this.#tree.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    if (box.top < area.top) this.#tree.scrollTop -= area.top - box.top;
    else if (box.bottom > area.bottom) this.#tree.scrollTop += box.bottom - area.bottom;
  }
  #shownKids() {
    const query = this.#input.value.trim().toLowerCase();
    return this.#cur.kids.filter((folder) => folder.name.toLowerCase().includes(query));
  }
  #renderTiles() {
    const shown = this.#shownKids();
    const stop = shown.find((folder) => this.#picked.has(folder)) ?? shown[0];
    this.#tiles.innerHTML = shown.map(
      (folder) => '<div class="ContentBrowser__tile' + (this.#picked.has(folder) ? " is-sel" : "") + '" role="option" aria-selected="' + this.#picked.has(folder) + '" tabindex="' + (folder === stop ? 0 : -1) + '"><div class="ContentBrowser__card"><div class="ContentBrowser__thumb"><svg><use href="#cb-folder64"/></svg></div><div class="ContentBrowser__label"><div>' + escape(folder.name) + "</div></div></div></div>"
    ).join("");
    this.#tiles.querySelectorAll(".ContentBrowser__tile").forEach((tile, i) => this.#tileFolder.set(tile, shown[i]));
    this.#renderStatus(shown);
    const clear = this.one(".ContentBrowser__clear");
    if (clear) clear.hidden = this.#input.value === "";
  }
  #renderStatus(shown) {
    const picked = shown.filter((folder) => this.#picked.has(folder)).length;
    const count = shown.length === 1 ? "1 item" : shown.length + " items";
    this.#status.textContent = picked === 0 ? count : count + " (" + picked + " selected)";
  }
  #rowOf(folder) {
    return Array.from(this.#tree.querySelectorAll(".ContentBrowser__row")).find((row) => this.#rowFolder.get(row) === folder);
  }
  #tileOf(folder) {
    return Array.from(this.#tiles.querySelectorAll(".ContentBrowser__tile")).find((tile) => this.#tileFolder.get(tile) === folder);
  }
  #folderOfTile(target) {
    const tile = target instanceof Element ? target.closest(".ContentBrowser__tile") : null;
    return tile ? this.#tileFolder.get(tile) : void 0;
  }
  // ---- input ----
  #pick(folder, toggle, range) {
    const shown = this.#shownKids();
    if (range && this.#anchor && shown.includes(this.#anchor)) {
      const from = shown.indexOf(this.#anchor);
      const to = shown.indexOf(folder);
      this.#picked = new Set(shown.slice(Math.min(from, to), Math.max(from, to) + 1));
    } else if (toggle) {
      if (!this.#picked.delete(folder)) this.#picked.add(folder);
      this.#anchor = folder;
    } else {
      this.#picked = /* @__PURE__ */ new Set([folder]);
      this.#anchor = folder;
    }
    this.#syncTiles();
    this.#tileOf(folder)?.focus();
  }
  // Updates the selection marks in place. The tiles must stay the same elements, or a double-click would lose its target.
  #syncTiles() {
    const shown = this.#shownKids();
    const stop = shown.find((folder) => this.#picked.has(folder)) ?? shown[0];
    for (const tile of this.#tiles.querySelectorAll(".ContentBrowser__tile")) {
      const folder = this.#tileFolder.get(tile);
      const picked = folder !== void 0 && this.#picked.has(folder);
      tile.classList.toggle("is-sel", picked);
      tile.setAttribute("aria-selected", String(picked));
      tile.tabIndex = folder === stop ? 0 : -1;
    }
    this.#renderStatus(shown);
  }
  #setSourcesWidth(width) {
    const room = this.#body.clientWidth - HANDLE_PX - MIN_ASSETS;
    const clamped = Math.round(Math.max(MIN_SOURCES, Math.min(room, width)));
    this.#sources.style.width = clamped + "px";
    this.#split.setAttribute("aria-valuenow", String(clamped));
  }
  #clearSearch() {
    this.#input.value = "";
    this.#renderTiles();
    this.#input.focus();
  }
  #toggleMenu(anchor, entries, onPick) {
    const previous = this.#menu;
    if (previous) {
      previous.close();
      if (previous.anchor === anchor) return;
    }
    anchor.setAttribute("aria-haspopup", "menu");
    this.#menu = openMenu(this.#top, anchor, {
      prefix: PREFIX,
      entries,
      onPick,
      onClose: () => {
        this.#menu = null;
      }
    });
  }
  #setSection(area, open) {
    const tree = area.querySelector(".ContentBrowser__tree");
    const arrow = area.querySelector(".ContentBrowser__head .ContentBrowser__arrow use");
    area.classList.toggle("is-collapsed", !open);
    if (tree) tree.hidden = !open;
    area.querySelector(".ContentBrowser__title")?.setAttribute("aria-expanded", String(open));
    arrow?.setAttribute("href", open ? "#cb-cd" : "#cb-cr");
  }
  #click(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const button = target.closest("button");
    if (button?.disabled) return;
    if (target.closest(".ContentBrowser__crumb")) {
      const at = this.all(".ContentBrowser__crumb").indexOf(target.closest(".ContentBrowser__crumb"));
      const folder = pathOf(this.#cur)[at];
      if (folder) this.#go(folder);
    } else if (target.closest(".ContentBrowser__nav--back")) {
      this.#walk(-1);
    } else if (target.closest(".ContentBrowser__nav--fwd")) {
      this.#walk(1);
    } else if (target.closest(".ContentBrowser__add")) {
      this.#toggleMenu(target.closest(".ContentBrowser__add"), ADD_ENTRIES, () => void 0);
    } else if (target.closest(".ContentBrowser__settings")) {
      const entries = Array.from(this.#checks, ([label, checked]) => ({ label, checkable: true, checked }));
      this.#toggleMenu(target.closest(".ContentBrowser__settings"), entries, (index) => {
        const label = entries[index].label ?? "";
        this.#checks.set(label, !this.#checks.get(label));
      });
    } else if (target.closest(".ContentBrowser__clear")) {
      this.#clearSearch();
    } else if (target.closest(".ContentBrowser__tool")) {
      const tool = target.closest(".ContentBrowser__tool");
      tool.setAttribute("aria-pressed", String(tool.getAttribute("aria-pressed") !== "true"));
    } else if (target.closest(".ContentBrowser__head")) {
      const area = target.closest(".ContentBrowser__area");
      if (area) this.#setSection(area, area.classList.contains("is-collapsed"));
    } else if (target.closest(".ContentBrowser__row")) {
      const row = target.closest(".ContentBrowser__row");
      const folder = this.#rowFolder.get(row);
      if (!folder) return;
      if (target.closest(".ContentBrowser__exp")) this.#toggleOpen(folder);
      else {
        this.#go(folder);
        this.#rowOf(folder)?.focus();
      }
    } else {
      const folder = this.#folderOfTile(target);
      if (folder) this.#pick(folder, event.ctrlKey || event.metaKey, event.shiftKey);
    }
  }
  #keydown(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const activate = event.key === "Enter" || event.key === " ";
    if (activate && target.matches(".ContentBrowser__title, .ContentBrowser__tool")) {
      event.preventDefault();
      target.click();
    } else if (target === this.#input) {
      if (event.key === "Escape" && this.#input.value !== "") {
        event.preventDefault();
        this.#clearSearch();
      }
    } else if (target === this.#split) {
      const step = event.shiftKey ? 50 : 10;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        this.#setSourcesWidth(this.#sources.offsetWidth + (event.key === "ArrowLeft" ? -step : step));
      }
    } else if (target.matches(".ContentBrowser__row")) {
      this.#treeKey(event, target);
    } else if (target.matches(".ContentBrowser__tile")) {
      this.#tileKey(event, target);
    }
  }
  #treeKey(event, row) {
    const folder = this.#rowFolder.get(row);
    if (!folder) return;
    const rows = Array.from(this.#tree.querySelectorAll(".ContentBrowser__row"));
    const at = rows.indexOf(row);
    const open = folder.kids.length > 0 && this.#open.has(folder);
    let go;
    switch (event.key) {
      case "ArrowDown":
        go = this.#rowFolder.get(rows[at + 1]);
        break;
      case "ArrowUp":
        go = this.#rowFolder.get(rows[at - 1]);
        break;
      case "Home":
        go = this.#rowFolder.get(rows[0]);
        break;
      case "End":
        go = this.#rowFolder.get(rows[rows.length - 1]);
        break;
      case "ArrowRight":
        if (folder.kids.length > 0 && !open) this.#toggleOpen(folder);
        else if (open) go = folder.kids[0];
        break;
      case "ArrowLeft":
        if (open) this.#toggleOpen(folder);
        else go = folder.parent ?? void 0;
        break;
      case "Enter":
      case " ":
        go = folder;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (go) {
      this.#go(go);
      this.#rowOf(go)?.focus();
    } else {
      this.#rowOf(folder)?.focus();
    }
  }
  #tileKey(event, tile) {
    const folder = this.#tileFolder.get(tile);
    if (!folder) return;
    const tiles = Array.from(this.#tiles.querySelectorAll(".ContentBrowser__tile"));
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
        this.#go(folder);
        this.#tiles.querySelector(".ContentBrowser__tile")?.focus();
        return;
      case " ":
        event.preventDefault();
        this.#pick(folder, event.ctrlKey || event.metaKey, event.shiftKey);
        return;
      default:
        return;
    }
    event.preventDefault();
    const next = go ? this.#tileFolder.get(go) : void 0;
    if (next) this.#pick(next, false, event.shiftKey);
  }
};
define("ue-content-browser", ContentBrowserElement);
