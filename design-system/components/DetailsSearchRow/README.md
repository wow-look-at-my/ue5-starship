# DetailsSearchRow

This is the row of the Details panel filter: a pill-shaped search box that fills the width. The property-matrix follows the row, favorites and view-options icon buttons.

## What the consumer provides

- The search text and a change handler. The box shows the hint "Search" while empty.
- Handlers for the buttons. Each is optional in source. The matrix button hides when it cannot open, the star shows only. When the favorites system is on, the options menu only when `bShowOptions` is set.
- The favorites state. The star is `--foreground` when off and `--accent-blue` when on.

Icons in `preview.html` are 16x16 stroke approximations. The Starship SVG files are not in the source tree.

## Metrics

| Part | Value | Source |
|---|---|---|
| Row background | `--panel` | `SDetailsView.cpp:391-395`, `StarshipCoreStyle.cpp:1123` |
| Search slot padding | 6 on all sides, fills the free width | `SDetailsView.cpp:278-280` |
| Search shape | fully rounded (half-height radius), fill `--input` | `StarshipCoreStyle.cpp:1303`, `SlateBrush.h:161-167` |
| Outline | 1px: `--secondary` normal, `--hover` hovered, `--primary` focused | `StarshipCoreStyle.cpp:1303-1305`, `CoreStyle.h:118` |
| Glass icon | 14px, left padding 4, `UseForeground` | `StarshipCoreStyle.cpp:1313,1315-1316`, `SSearchBox.cpp:135-146` |
| Text padding | 8,3,8,4 | `StarshipCoreStyle.cpp:1289` |
| Text font | Normal 10pt = 13.333px | `StarshipCoreStyle.cpp:36,1288` |
| Text colour | `--foreground` idle, `--foreground-hover` focused | `StarshipCoreStyle.cpp:1290,1293` |
| Hint text | text colour at alpha 0.35 | `SlateEditableTextLayout.cpp:3562-3563` |
| Clear button | appears when text is present: ThinHoverOnlyButton, 16px icon, left padding 4 | `SSearchBox.cpp:156-157`, `StarshipCoreStyle.cpp:1458-1463` |
| Trailing spacer | 7 | `SSearchBox.cpp:176-179` |
| Matrix and favorites buttons | SimpleButton, default content padding (4,2) + (2,1) = 28x22 | `SDetailsView.cpp:298-330`, `StarshipCoreStyle.cpp:1405-1407` |
| Options button | SComboButton, no arrow, content padding 0 + (2,1) = 20x18 | `SDetailsView.cpp:348-362` |
| Button hover | fill `--dropdown` radius 4, icon `--foreground-hover` | `StarshipCoreStyle.cpp:1391,1394-1395` |
| Button icons | 16px, `UseForeground` (`--foreground` at rest) | `SDetailsView.cpp:305-307,326-329,335-337` |
| Star colour | `--foreground` off, `--accent-blue` on | `SDetailsView.cpp:1177-1183` |

## Do

- Keep the search box and the buttons on one row, buttons vertically centred.
- Use the pill radius on the search box only. Buttons and the other fields use radius 4.
- Keep the 7px spacer at the right end of the search box. The pill needs the room so the clear button clears the rounded cap.

## Don't

- Do not give the icon buttons a resting fill or outline.
- Do not use `--input-outline` for the search outline. Search uses `--secondary`, plain text boxes use `--input-outline`.
- Do not make the options button 28px wide. It is the narrow 20x18 combo.
