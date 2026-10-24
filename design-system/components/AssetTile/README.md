# AssetTile

The tile-view item of the area of the Content Browser asset. A folder tile (tinted folder icon over a centred name) and a generic asset tile (square thumbnail with a 2px type-colour strip over a name and type label), each with normal, hovered, selected and selected + hovered states.

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
