# Content Browser notes

Source: UE 5.5.3 fork. Active style is the old one: `ContentBrowser.Build.cs:9` sets `UE_CONTENTBROWSER_NEW_STYLE=0`, so every `#if UE_CONTENTBROWSER_NEW_STYLE` branch is ignored and the `#else` values are used. No value was taken from the 5.8.1 reference checkout.

Short names: SS = `Editor/EditorStyle/Private/StarshipStyle.cpp`, SCS = `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp`, SCB = `Editor/ContentBrowser/Private/SContentBrowser.cpp`, AVW = `.../AssetViewWidgets.cpp`, SAV = `.../SAssetView.cpp`.

## Constants used

| Name | Value | File:line |
|---|---|---|
| Normal font | 10pt Regular = 13.333px | SCS:36 |
| Normal bold font | 10pt Bold | SCS:38 |
| Small font | 8pt | SCS:40 |
| Default foreground | `FStyleColors::Foreground` | SCS:172 |
| Tile name font | Regular 9pt = 12px | SS:6367 |
| Tile class font | Regular 7pt = 9.333px | SS:6368, 6477 |
| Source tree font | NormalFont | SS:6331-6332 |
| Default folder colour | `FStyleColors::AccentFolder` (#b68f55) | SS:6348 |
| Folder icon (tree) | 16x16 `folder-closed` / `folder-open` | SS:6336-6337 |
| Folder icon (tile) | 64x64 `Starship/ContentBrowser/folder` | SS:6533 |
| Folder drop shadow | 256x256 PNG | SS:6579 |
| Tile drop shadow | 9-slice `drop-shadow` margin 4/64 | SS:6578 |
| Folder hover / selected background | Secondary, radius 4 | SS:6540-6542 |
| Asset thumbnail area background | Recessed, radius 4 | SS:6543 |
| Name area background | Secondary / Hover / Primary / PrimaryHover, radii (0,0,4,4) | SS:6544-6547 |
| State outline | transparent fill, 1px Hover / Primary / PrimaryHover, radius 4 | SS:6563-6575 |
| Thumbnail background | Recessed | SS:1229 |
| Content browser toolbar style | SlimToolBar copy: separator none, separator padding (4,0), background padding (4,2,0,2) | SS:6620-6626 |
| Slim toolbar background | Panel | SCS:2209-2262 (SlimToolbarBackground) |
| Toolbar separator thickness | 2 | ToolBarStyle.cpp:25 |
| Toolbar block padding | 0 | ToolBarStyle.cpp:29 |
| Layout: top row | Border Padding(3), Panel | SCB:764-766 |
| Layout: tool slot | Padding(5,0,0,0) | SCB:772 |
| Layout: back / forward | Padding(10,0,0,0) / (2,0,0,0), ContentPadding(1,0) | SCB:778-812 |
| Layout: path slot | Padding(2,0,0,0), fill | SCB:816-820 |
| Layout: view options slot | Padding(5,0,0,0) | SCB:848 |
| Layout: separator | Thickness 2, Recessed | SCB:859-862, SCS:707 |
| Layout: splitter handle | 2px | SCB:871, 897 |
| Layout: sources box | Padding(4), Recessed | SCB:880, 886 |
| Layout: section blocks | Header, Padding(0,2,0,0); min slot height 26 | SCB:900, 907-909 |
| Layout: asset area | Panel, Padding(2,2,2,0) | SCB:1445-1447 |
| Layout: search row | Padding(6,4,0,0); filter slot Padding(0,0,2,0); box width 500 | SCB:1249, 1361-1385 |
| Settings button | SimpleComboButton, no arrow, icon + label Padding(4,0) | SCB:494-518 |
| Add button | SPositiveActionButton, Icons.Plus, text "Add" | SCB:1799-1806 |
| Save All button | SimpleButton, ContentPadding(2), icon + 3px + text | SCB:1835-1865 |
| Import button | same shape as Save All | ContentBrowserAssetDataSource.cpp:3603-3630 (Engine/Plugins/Editor/ContentBrowser) |
| Action button geometry | height 22, icon 16, gap 3, vertical padding 3, horizontal padding 2 | ToolWidgetsStylePrivate.h:22-28 |
| Positive action icon | AccentGreen | ToolWidgetsStyle.cpp:76 |
| Button style | Secondary fill, 1px Input outline, radius 4; padding (12,1.5) | SCS:1372-1383, CoreStyle.h:110 |
| SimpleButton | no fill; hover/press Dropdown radius 4; padding (4,1) label+icon variant, (2,1) icon-only | SCS:1389-1407 |
| SButton padding rule | ContentPadding + style padding (additive) | SButton.cpp:159-163 |
| Expandable area | caret 16, title padding right 3, header content padding (4,0), title NormalFontBold | SCS:561-568, SExpandableArea.h:40, SCB:1471-1488 |
| Search toggle | ToggleButtonCheckbox, Padding 4 | SSearchToggleButton.cpp:32-33, SCS:1625-1641 |
| Table row style | Select / SelectInactive / SelectParent / SelectHover, text Foreground, selected text ForegroundHover | SCS:2000-2025 |
| Tree arrows | caret-right / caret-down 16 | SCS:2072-2075 |
| Tree row padding | root top 3; icon right 2 | SourcesViewWidgets.cpp:138, 144 |
| Tree indent | 10 per level | SExpanderArrow.cpp:73, 182 |
| Breadcrumb defaults | SimpleButton, ContentPadding(2,2), delimiter Icons.ChevronRight, delimiter ContentPadding(3,0) | SNavigationBar.h:43-46, SBreadcrumbTrail.h:198 |
| Search box | pill, Input fill, 1px Secondary / Hover / Primary, padding (8,3,30,4), glass left, image 14 | SCS:893-900, 1301-1318, SlateBrush.h:161-167 |
| Search hint alpha | 0.35 | SlateEditableTextLayout.cpp:3563 |
| Filter button | SimpleComboButtonWithIcon, ContentPadding(1,0), Icons.Filter | SBasicFilterBar.h:255-273, SCS:1522-1524 |
| Combo down arrow padding | default 2 | SlateTypes.cpp:165 |
| Tile thumbnail size constants | tile 150, padding 9, name height 50, list padding 4 | SAV:1108-1123 |
| Thumbnail scale | min 0.2, max 1.9 times display-height/2160, divided by DPI scale; Medium = 0.5 | SAV:1102, 1946-1947, 5589-5617 |
| Tile item width | `(150 + 2*9) * Lerp(min, max, scale)` | SAV:5727, 5750 |
| Tile item height | `(50 + typeNameHeight) * Lerp(...) + baseHeight` (type name height 50 when type shown) | SAV:5676-5678, 5718 |
| Tile cell padding | ChildSlot (0,0,4,4), shadow border (0,0,5,5) | AVW:2204, 2208 |
| Thumbnail box | item width - 9 | AVW:2389 |
| Folder overlay | Padding 5; shadow border (0,0,2,2) | AVW:173, 177 |
| Name area | Border (2,3); name slot (2,2,0,0) | AVW:2237, 2242 |
| Thumbnail padding | 2 | AVW:2040 |
| Colour strip | 2px | AssetThumbnail.cpp:1050-1053 |
| Name / class text colour | White when hovered/selected; Foreground; class Foreground at 0.6 alpha | AVW:2400-2407, 2572-2579, WidgetStyle.cpp:11 |
| Status text | Padding(8,5), "N items" | SAV:1383-1387, 5513-5535 |

## Derived

- Cell width at 1080p, 125% DPI, Medium: 168 x 0.485 = about 81.5, used as 82. Cell height about 130. Both depend on display height and DPI. They were cross-checked against the reference screenshot (tile pitch 102 device px).
- Toolbar row 32px: 22 button + 2 + 2 toolbar padding + 3 + 3 row padding.
- Section header 24px: the search toggle (Padding 4 + 16 icon) is the tallest item.
- Tree row 16px: expander and folder icon are 16px.

## Not found / approximated

- All Starship SVG icons and the tile PNG shadows (`folder-drop-shadow`, `drop-shadow`) are not in the tree. By hand, icons were redrawn, shadows approximated with CSS.
- Disabled-widget appearance: Slate uses a DisabledEffect in `SlateElementPixelShader.usf:514`. The preview uses opacity 0.45 (value not traced).
- `ContentBrowserUtils::GetDefaultColor` / `GetPathColor` were not read. The default folder colour is taken from `ContentBrowser.DefaultFolderColor` (SS:6348).
- The reference screenshot differs from the 5.5.3 source in multiple places: the save-search icon outside the field with an empty field (source: plus-circle inside the field, only with text, `SFilterSearchBox.cpp:171-189`). The filter button after the field (source: before it, `SCB:1366-1385`), and a folder glyph before the breadcrumb (no source found). The breadcrumb also shows no outline although source wraps it in a combo button (`SNavigationBar.cpp:124-128`). The previews follow the screenshot and the AssetSearchBar README shows the source layout too.
- Tree selection colour: the screenshot shows the unfocused `SelectInactive`. The SourcePanel preview shows `Select` and the ContentBrowser preview shows `SelectInactive`.
- Scrollbars (tree and tile grid) are not drawn.
- Not covered: list and column views, filter pills (`SFilterList`), collection tree rows, tooltips and the thumbnail edit-mode UI.
