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

// src/_shared/tileGrid.ts
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

// src/AssetTile/AssetTile.ts
var SELECTED = "is-selected";
var AssetTileElement = class extends UeElement {
  #anchor = null;
  #opened = "";
  setup() {
    this.#anchor = null;
    this.#opened = "";
    for (const group of this.#groups()) {
      group.setAttribute("role", "listbox");
      group.setAttribute("aria-multiselectable", "true");
      for (const tile of this.#tiles(group)) {
        tile.setAttribute("role", "option");
        tile.setAttribute("aria-selected", String(tile.classList.contains(SELECTED)));
      }
      this.#rove(group, null);
    }
    this.#status();
    this.on(this, "click", (event) => this.#click(event));
    this.on(this, "dblclick", (event) => this.#open(this.#tileAt(event.target)));
    this.on(this, "keydown", (event) => this.#keydown(event));
  }
  #groups() {
    const groups = /* @__PURE__ */ new Set();
    for (const tile of this.all(".AssetTile")) if (tile.parentElement) groups.add(tile.parentElement);
    return Array.from(groups);
  }
  #tiles(group) {
    return Array.from(group.children).filter((child) => child instanceof HTMLElement && child.classList.contains("AssetTile"));
  }
  #tileAt(target) {
    return target instanceof Element ? target.closest(".AssetTile") : null;
  }
  #name(tile) {
    return (tile.querySelector(".AssetTile__name")?.textContent ?? "").trim();
  }
  // One tile per group takes the Tab stop: `stop`, else the first selected tile, else the first tile.
  #rove(group, stop) {
    const tiles = this.#tiles(group);
    const chosen = stop ?? tiles.find((tile) => tile.classList.contains(SELECTED)) ?? tiles[0];
    for (const tile of tiles) tile.tabIndex = tile === chosen ? 0 : -1;
  }
  #mark(tile, selected) {
    tile.classList.toggle(SELECTED, selected);
    tile.setAttribute("aria-selected", String(selected));
  }
  // Applies a click or key movement to the selection of the tile's group.
  #choose(tile, toggle, range) {
    const group = tile.parentElement;
    if (!group) return;
    const tiles = this.#tiles(group);
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
    this.#rove(group, tile);
    this.#status();
    this.emit("assettile:select", { names: tiles.filter((each) => each.classList.contains(SELECTED)).map((each) => this.#name(each)) });
  }
  #click(event) {
    const tile = this.#tileAt(event.target);
    if (!tile) return;
    this.#choose(tile, event.ctrlKey || event.metaKey, event.shiftKey);
    tile.focus();
  }
  #open(tile) {
    if (!tile) return;
    const name = this.#name(tile);
    this.#opened = name;
    this.#status();
    this.emit("assettile:open", { name, folder: tile.classList.contains("AssetTile--folder") });
  }
  #status() {
    const line = this.one(".AssetTilePreview__status");
    if (!line) return;
    const selected = this.all(".AssetTile." + SELECTED).map((tile) => this.#name(tile));
    const head = selected.length === 0 ? "Nothing selected" : selected.length + " selected: " + selected.join(", ");
    line.textContent = head + (this.#opened ? ". Opened: " + this.#opened : "");
  }
  #keydown(event) {
    const tile = event.target instanceof HTMLElement && event.target.matches(".AssetTile") ? event.target : null;
    const group = tile?.parentElement;
    if (!tile || !group) return;
    const tiles = this.#tiles(group);
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
        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        for (const each of tiles) this.#mark(each, true);
        this.#status();
        return;
      default:
        return;
    }
    event.preventDefault();
    if (!go) return;
    if (event.ctrlKey || event.metaKey) {
      this.#rove(group, go);
    } else {
      this.#choose(go, false, event.shiftKey);
    }
    go.focus();
  }
};
define("ue-asset-tile", AssetTileElement);
