# ContentBrowser

The composed Content Browser panel: ContentToolbar on top, a 2px separator, then a splitter between the SourcePanel and the asset area (AssetSearchBar, a wrapping grid of AssetTile items, and an "N items" status line).

## Composed from

| Part | Built from |
|---|---|
| Top row | `ue-content-toolbar` |
| Sources column | `ue-source-panel` (`SourcePanel--fill`) |
| Split between the columns | `ue-splitter` (`splitter-handle--line`, `data-min-start="120"`, `data-min-end="200"`) |
| Search row | `ue-asset-search-bar` |
| Folder tiles | `ue-asset-tile` |

The composite has no control of its own. `src/ContentBrowser/ContentBrowser.ts` keeps the folder model and the current folder, and wires the events of the parts:

| From | Event | The browser does |
|---|---|---|
| toolbar | `contenttoolbar:navigate` | shows that folder |
| source panel | `sourcepanel:select` | goes to that folder and records it in the toolbar history |
| asset tiles | `ue-tile-open` | goes to that folder |
| asset tiles | `ue-tile-select` | updates the selected count |
| search bar | `assetsearchbar:change` | redraws the tiles for the text |

A step to a folder opens its ancestors in the tree, selects it there, redraws the crumbs, clears the search and redraws the tiles. The history lives in the toolbar. The tree state lives in the source panel. The tile selection lives in the asset tiles.

## What the consumer provides

- Everything the child components take (see their READMEs): the folders (the model is in `ContentBrowser.ts`), the split position of the sources column (the slot starts at 340px and the user resizes it) and the status text ("10 items", "1 item", "N items (M selected)").

## Structure and metrics owned by the browser

| Part | Value | Source |
|---|---|---|
| Separator under the top row | 2px, `--recessed` | `SContentBrowser.cpp:859-862`, `StarshipCoreStyle.cpp:707` |
| Body splitter handle | 2px, `--background` | `SContentBrowser.cpp:871`, `StarshipCoreStyle.cpp:633-635` |
| Sources slot | 340px to start, 120px minimum | `SContentBrowser.cpp:874-883` |
| Asset area | `--panel`, padding (2,2,2,0), at least 200px | `SContentBrowser.cpp:1445-1447` |
| Tile grid | scrolls inside the asset area; cells of ~82 x 130 | `SAssetView.cpp:5718,5731` |
| Status line | text padding (8,5), Normal 10pt `--foreground` | `SAssetView.cpp:1380-1387`, `SAssetView.cpp:5513-5535` |
| Splitter slots | sources slot sized to content (user resizable); asset slot `Value(0.75)` | `SContentBrowser.cpp:876,957` |

The grid uses a "fill empty space" option (`SContentBrowser.cpp:484`) so cells stretch slightly to use the full row. The preview uses fixed cells.

## Events

| Event | `detail` | When |
|---|---|---|
| `contentbrowser:navigate` | `{ path }` | The current folder changed |

## Do

- Let the asset grid wrap. Rows are `ItemHeight` tall with no extra gap.
- Keep the selected tree row `--select-inactive` when the browser does not have focus (as in the reference screenshot), `--select` when it does.

## Don't

- Do not add a divider between the search row and the tiles. The asset area is one flat `--panel` surface.
- Do not draw the lock or dock buttons unless the consumer enables them.

## Icons

Starship SVG icons and tile images are not available. See the child READMEs for the approximations used.
