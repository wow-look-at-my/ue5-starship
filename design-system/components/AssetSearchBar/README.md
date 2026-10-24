# AssetSearchBar

The search row at the top of the area of the Content Browser asset: a pill-shaped search field with a leading magnifier. This also covers an icon button to save the search, and a filter icon button with a dropdown chevron.

## What the consumer provides

- Hint text ("Search <current folder>"), the typed text and its change / commit handlers.
- Handlers for the save-search and filter-menu buttons.

## Metrics

| Part | Value | Source |
|---|---|---|
| Row padding | 6px left, 4px top | `SContentBrowser.cpp:1362` |
| Field width | 500px | `SContentBrowser.cpp:1249,1380` |
| Field shape | pill (radius = half height), fill `--input`, 1px outline `--secondary`; hover outline `--hover`; focus outline `--primary` | `StarshipCoreStyle.cpp:1301-1306`, `SlateRoundedBoxBrush.h:116-128`, `SlateBrush.h:161-167` |
| Text padding | left 8, top 3, right 30, bottom 4 (right space is for the buttons) | `StarshipCoreStyle.cpp:893-900` |
| Text | Normal 10pt, `--foreground`; focused `--white` | `StarshipCoreStyle.cpp:1283-1285` |
| Hint | text colour at 0.35 alpha | `SlateEditableTextLayout.cpp:3562-3563` |
| Magnifier | left aligned, 14px (image size override), 4px left padding | `StarshipCoreStyle.cpp:1309-1318` |
| Clear (X) | shown only while text is non-empty, hover-only button | `SSearchBox.cpp:150-169` |
| Save-search button | icon button: `SimpleButton` padding 2px x 1px, 16px icon, hover `--dropdown` radius 4 | `StarshipCoreStyle.cpp:1405-1407,1389-1394` |
| Filter button | `SimpleComboButtonWithIcon`: padding 3 x 1 (ContentPadding(1,0) + (2,1)), 16px filter icon, 2px, 16px chevron | `SBasicFilterBar.h:255-273`, `StarshipCoreStyle.cpp:1522-1524`, `SlateTypes.cpp:165` |
| Gap between icon buttons | 2px in the preview; source only specifies Padding(0,0,2,0) on the filter slot, the reference screenshot spacing is approximated | `SContentBrowser.cpp:1369` |

## Layout differences to know about

The reference screenshot shows `[field] [save] [filter v]`. In the 5.5.3 source the filter combo button comes first (`SContentBrowser.cpp:1366-1385`). The save-search action is a plus-circle button drawn inside the field, visible only when text is typed (`SFilterSearchBox.cpp:171-189`, `Icons.PlusCircle`). The preview shows both. The first a couple of rows follow the screenshot, the third follows the source. The standalone save icon, its position, and the empty-field visibility come from the screenshot, not from source.

## Do

- Keep the field a pill. This is the only pill-shaped input in the editor chrome (other inputs use radius 4).
- Show the X only when there is text.

## Don't

- Do not put the filter button inside the field.
- Do not widen the text right padding below 30px. The in-field buttons overlap otherwise.

## Icons

Starship SVGs are not available. Magnifier, floppy, filter lines, chevron, X and plus-circle in `preview.html` are 16px stroke approximations.
