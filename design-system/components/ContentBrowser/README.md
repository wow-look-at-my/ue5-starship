# ContentBrowser

The composed Content Browser panel: ContentToolbar on top, a 2px separator, then a splitter between the SourcePanel and the asset area (AssetSearchBar, a wrapping grid of AssetTile items, and an "N items" status line).

## What the consumer provides

- Everything the child components take (see their READMEs): breadcrumb crumbs, tree rows, tiles, search text.
- The item count text ("10 items", "1 item", "N items (M selected)").
- The split position of the sources column (user resizable. The preview uses 340px).

## Structure and metrics

| Part | Value | Source |
|---|---|---|
| Top row | ContentToolbar, 32px, `--panel` | `SContentBrowser.cpp:764-855` |
| Separator under the top row | 2px, `--recessed` | `SContentBrowser.cpp:859-862`, `StarshipCoreStyle.cpp:707` |
| Body splitter handle | 2px, `--background` | `SContentBrowser.cpp:871`, `StarshipCoreStyle.cpp:633-635` |
| Sources column | SourcePanel (4px outer padding), resizable | `SContentBrowser.cpp:874-883` |
| Asset area | `--panel`, padding (2,2,2,0) | `SContentBrowser.cpp:1445-1447` |
| Search row | AssetSearchBar | `SContentBrowser.cpp:1361-1385` |
| Tile grid | cells of ~82 x 130, wrapping; no gap beyond the per-cell padding | `SAssetView.cpp:5718,5731` |
| Status line | text padding (8,5), Normal 10pt `--foreground` | `SAssetView.cpp:1380-1387`, `SAssetView.cpp:5513-5535` |
| Splitter slots | sources slot sized to content (user resizable); asset slot `Value(0.75)` | `SContentBrowser.cpp:876,957` |

The grid uses a "fill empty space" option (`SContentBrowser.cpp:484`) so cells stretch slightly to use the full row. The preview uses fixed cells.

## Do

- Let the asset grid wrap. Rows are `ItemHeight` tall with no extra gap.
- Keep the selected tree row `--select-inactive` when the browser does not have focus (as in the reference screenshot), `--select` when it does.

## Don't

- Do not add a divider between the search row and the tiles. The asset area is one flat `--panel` surface.
- Do not draw the lock or dock buttons unless the consumer enables them.

## Icons

Starship SVG icons and tile images are not available. See the child READMEs for the approximations used.
