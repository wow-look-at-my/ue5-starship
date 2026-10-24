# PopupMenu

A flat, sharp-cornered list on `--dropdown` where each row is an optional check cell, an optional icon, a label. An optional key binding and an optional submenu arrow. The hovered row fills with Primary.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (`SetupMultiboxStyles`, `MenuBar` block, lines 2286-2449), abbreviated `SCS`. Row layout is in `Runtime/Slate/Private/Framework/MultiBox/SMenuEntryBlock.cpp` (abbreviated `SME`), the box padding in `MultiBox.cpp`, the popup background in `Framework/Application/MenuStack.cpp`. The editor style only adds `Menu.Label.Padding` and `Menu.Label.ContentPadding` (`StarshipStyle.cpp:2868-2869`), which are separate from this row layout.

## What the consumer provides

- Label text, and optionally a 14px icon, a key binding text, a check or radio state, a submenu.
- Heading text. The widget converts it to upper case (`SHeadingBlock.cpp:62`).
- The Starship icon SVGs are not available. `preview.html` draws approximations.

## Metrics

Slate unit = 1px. The 16px text line box is derived from Roboto metrics, not read from source.

| Property | Value | Source |
|---|---|---|
| Popup fill (`Menu.Background`) | `--dropdown` | `SCS:2302`; `MenuStack.cpp:113` |
| Popup outline (`Menu.Outline`) | 1px `--dropdown-outline`, radius 0, transparent fill | `SCS:2303`; `MenuStack.cpp:118` |
| Popup vertical padding | 8 top, 8 bottom | `MultiBox.cpp:1344` |
| Row padding (style part) | 12 left, 1 top, 5 right, 1 bottom | `SCS:2314-2316` |
| Row button padding | 0 left/right, 2 top/bottom; pressed: top 3, bottom 1 | `SCS:2423-2424` |
| Total row padding | 12 / 3 / 5 / 3; pressed 12 / 4 / 5 / 2 | `SButton.cpp:159-164` sums both |
| Row height | 22px = 16px line + 3 + 3 | derived |
| Row fill normal | none | `SCS:2419` |
| Row fill hovered and pressed | `--primary`, whole width, no radius | `SCS:2420-2421` |
| Row foreground | `--foreground-hover` (white); the button inherits `NoBorder` | `SCS:237-239`, `2422` |
| Label | Normal 10pt = 13.33px, padding 2 left, 6 right, fills the width | `SCS:2321`; `SME:600-609` |
| Key binding | Small 8pt = 10.67px, foreground at 60% alpha, 25px gap before it, then box padding 16 left and 4 right | `SCS:2324`; `SME:610-625`; `WidgetStyle.cpp:11` |
| Icon cell | 16 wide (icon 14 + 2), 14 high, padding 2 left and 6 right; collapsed when the row has no icon | `SCS:2312`; `SME:581-599` |
| Icon colour | foreground at 60% alpha | `SME:504` |
| Check cell | padding 2 left and 8 right; width shared by all rows of the menu (linked column) | `SME:630-650`; `SLinkedBox.cpp:109-112` |
| Check glyph (`Menu.Check`) | 16x16 SVG tinted by the foreground (white) | `SCS:2342-2357`; `SME:640` |
| Radio dot (`Menu.RadioButton`) | 8x8 circle: unchecked `--input`, pressed `--hover-2`, checked `--white` | `SCS:2390-2400` |
| Content slot offset | 2px after the check cell | `SME:652` |
| Submenu arrow (`Menu.SubMenuIndicator`) | 16x16 chevron, 7px left padding, tinted by the foreground | `SCS:2306`; `SME:933-940` |
| Separator | 1px `--white-25`, padding 12 left/right and 6 top/bottom | `SCS:2318-2319`; `SMenuSeparatorBlock.cpp:51-56` |
| Heading | 7pt Bold = 9.33px, letter spacing 0.25 em, `--white-25`, padding 12 / 6 | `SCS:2327-2334`; `SlateTextShaper.cpp:412` |
| Heading rule | a 1px `--white-25` line after the text, 14px gap | `SHeadingBlock.cpp:67-74` |
| Disabled row | normal look at 45% alpha | `SlateElementPixelShader.usf:535` |
| Widget border (`Menu.WidgetBorder`) | `--input` fill, radius 5, for embedded widgets | `SCS:2289` |
| Menu bar item (`WindowMenuBar.Button`) | hovered fill `--hover`; foreground `--foreground`, hovered and pressed `--foreground-hover`; open submenu fill `--primary`; content padding 12 x 4 | `SCS:2433-2448` |

So a label with an icon starts at x = 12 + 2 + 8 + 2 + 2 + 16 + 6 + 2 = 50 and a label without an icon at x = 26 (column width 0). This happens when the menu has no check or radio rows the check column is 0 wide but its padding stays (2 + 8). A 16px column adds 16 to both. This sum follows from the paddings above and is derived, not measured.

## Do

- Fill the hovered row edge to edge. There is no radius and no inset.
- Give all rows of one section either an icon or none, as the engine's own policy says (`SME:513-515`).
- Keep the key binding right-aligned and dim.

## Don't

- Do not draw rounded rows or an inner shadow.
- Do not tint icons with Primary. They are white at 60% alpha.
- Do not add a gap between the popup and its parent. The source defines none.
