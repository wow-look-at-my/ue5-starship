# AssetTile

The tile-view item of the area of the Content Browser asset. A folder tile (tinted folder icon over a centred name) and a generic asset tile (square thumbnail with a 2px type-colour strip over a name and type label), each with normal, hovered, selected and selected + hovered states.

One `<ue-asset-tile>` wraps exactly one tile grid: a `listbox` of tiles with selection, grid keys and open.

## Markup contract

```html
<ue-asset-tile select="multi">       <!-- select="single" picks one tile whatever the modifiers -->
	<div class="AssetTile-grid">     <!-- a wrapping flex row; the element sets role="listbox" -->
		<div class="AssetTile AssetTile--folder" data-id="audio">
			<div class="AssetTile__card">
				<div class="AssetTile__thumb"><svg class="AssetTile__folderIcon" viewBox="0 0 64 64">...</svg></div>
				<div class="AssetTile__nameArea"><div class="AssetTile__name">Audio</div></div>
			</div>
		</div>
		<div class="AssetTile AssetTile--asset" data-id="sm_chair">
			<div class="AssetTile__card">
				<div class="AssetTile__thumb"><div class="AssetTile__asset"><svg viewBox="0 0 32 32">...</svg><span class="AssetTile__strip" style="--strip:var(--accent-blue)"></span></div></div>
				<div class="AssetTile__nameArea"><div class="AssetTile__name">SM_Chair</div><div class="AssetTile__class">Static Mesh</div></div>
			</div>
		</div>
	</div>
</ue-asset-tile>
```

- The element sets `role="option"`, `aria-selected`, `tabindex` (one tile takes the Tab stop: the selected one, else the first) and the class `is-selected`. An author writes only the initial `is-selected`. `data-id` is the tile id in events and the API. Without it the text of `.AssetTile__name` is the id.
- The thumbnail of an asset is a `.AssetTile__asset` box. Put a cube `<svg>` or an `<img class="AssetTile__image">` in it. The strip colour is the CSS variable `--strip`.
- Hover and keyboard focus need no script: `.AssetTile:hover` and `:focus-visible` carry the look. A forced specimen uses `is-hover` and `is-selected`, and takes `data-pinned` (on the tile or on a row of tiles) so the page ignores the pointer.
- The folder glyph is inline, 64x64, `fill="currentColor"` plus overlay paths. No `<symbol>` is needed.

## Selection and keys

- Click replaces the selection. Ctrl or Cmd toggles a tile. Shift selects the range from the anchor. A double-click opens the tile.
- Right and Left move by one tile. Up and Down go to the nearest tile in the next row. Home and End jump. Shift extends the selection from the anchor, Ctrl moves the focus without selecting. Space selects like a click. Enter opens. Ctrl+A selects all.
- `select="single"` ignores Shift, Ctrl and Ctrl+A. Every pick replaces the selection and `aria-multiselectable` is `false`.

## Events

Both events bubble and are composed. A handler ignores an event from a nested `ue-asset-tile`.

| Event | `detail` | When |
|---|---|---|
| `ue-tile-select` | `{ ids: string[] }` | The selected set changed, in grid order. A click on the only selected tile fires nothing |
| `ue-tile-open` | `{ id: string }` | A double-click or Enter on a tile |

## Data API

```ts
interface TileData {
	id: string;
	label: string;
	kind: 'folder' | 'asset';
	thumb?: string;      // image URL for an asset; without it the tile draws a cube
	typeLabel?: string;  // "Static Mesh", under the name of an asset
	strip?: string;      // CSS colour of the 2px strip of an asset
	selected?: boolean;
}
el.setTiles(tiles: TileData[]);     // replaces every tile; an element with no .AssetTile-grid creates one
el.getSelectedIds(): string[];
el.select(ids: string[]);           // fires ue-tile-select
```

## What the consumer provides

- Kind (folder or asset), name text, and for assets the class label, the thumbnail content and the asset-type colour for the strip.
- Folder colour (default `--accent-folder`, set per folder).
- State: hovered, selected.

## Size

`ItemWidth = (150 + 2 x 9) x Lerp(Min, Max, Scale)` where the scale depends on the display height and DPI (`SAssetView.cpp:1116-1127, 1946-1947, 5589-5617, 5727-5750`). On a 1080p display at 125% DPI with Medium thumbnails this gives about **82px** per cell, which matches the reference screenshot (cell pitch 102 device px / 1.25). The previews use 82 x 130. Treat both as display-derived, not constants. The card is the cell minus 4px (`ChildSlot` padding) and 5px (shadow border) on the right and bottom: **73 x 121**.

## Metrics

| Part | Value | Source |
|---|---|---|
| Cell padding right/bottom | 4 + 5 = 9px | `AssetViewWidgets.cpp:2204,2208` |
| Thumbnail box | cell width - 9 (73px), square | `AssetViewWidgets.cpp:2384-2391`, `SAssetView.cpp:1121` |
| Cell height | `(TileViewNameHeight 50 + type-name height 50) x scale + cell width` ~ 130 when the type label is shown | `SAssetView.cpp:1123,5676-5678,5718` |
| Folder icon box | overlay padding 5, inner padding (0,0,2,2); image 64x64 `ContentBrowser.ListViewFolderIcon` | `AssetViewWidgets.cpp:173,177`, `StarshipStyle.cpp:6533` |
| Folder colour | `ContentBrowser.DefaultFolderColor` = `--accent-folder` | `StarshipStyle.cpp:6348` |
| Folder shadow | `folder-drop-shadow.png` 256x256 (image missing; preview uses a CSS drop-shadow) | `StarshipStyle.cpp:6579` |
| Folder hover / selected background | `--secondary`, radius 4 (all three states) | `StarshipStyle.cpp:6540-6542` |
| Asset card background | `--recessed`, radius 4 | `StarshipStyle.cpp:6543` |
| Thumbnail inset | 2px; thumbnail background `--recessed`; colour strip 2px at the bottom edge | `AssetViewWidgets.cpp:2040`, `StarshipStyle.cpp:1229`, `AssetThumbnail.cpp:1050-1053` |
| Name area (asset) | `--secondary`, bottom radii 4; hover `--hover`; selected `--primary`; selected + hover `--primary-hover` | `StarshipStyle.cpp:6544-6547` |
| Name area padding | border (2,3); name slot (2,2,0,0); folder name centred | `AssetViewWidgets.cpp:2237,2242-2244` |
| Name font | Regular 9pt = 12px | `StarshipStyle.cpp:6367`, `AssetViewWidgets.cpp:2438-2439` |
| Class label font | Regular 7pt = 9.333px, `--foreground` at 0.6 alpha (subdued); white when hovered or selected | `StarshipStyle.cpp:6477`, `AssetViewWidgets.cpp:2400-2407`, `WidgetStyle.cpp:11` |
| Name colour | `--foreground`; `--white` when hovered or selected | `AssetViewWidgets.cpp:2572-2579` |
| State outline | 1px inside, radius 4: hover `--hover` (assets only), selected `--primary`, selected + hover `--primary-hover` | `StarshipStyle.cpp:6563-6575`, `AssetViewWidgets.cpp:2344-2365` |
| Card shadow | `drop-shadow.png` 9-slice (image missing; preview uses a CSS box-shadow) | `StarshipStyle.cpp:6578` |
| Names | up to 3 lines for folders, ellipsis at the end | `AssetViewWidgets.cpp:2111,2588-2596,2650-2655` |

## Do

- Show the hover outline only on asset tiles. Hovered folders change background and gain the shadow but get no outline.
- Draw the type strip in the asset-type colour, not the folder colour.

## Don't

- Do not hardcode 82 / 130. Take them from the view scale or accept a size token.
- Do not draw a name-area background on folders. They have none at rest.

## Icons

Starship folder and shadow images are not available. The folder in `preview.html` is a hand-drawn 64x64 SVG that approximates `Starship/ContentBrowser/folder.svg`. The asset placeholder is a generic cube outline.
