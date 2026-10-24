A slim horizontal toolbar of icon, label, toggle and combo buttons on a Panel strip, with separators. This also covers the green Play button group and an overflow button.

## What the consumer provides

- The strip (`.toolBar`) and one `.toolBar-slot` wrapper per block. The slot carries the block padding. The inner element carries the button look.
- Icons as inline SVG, 20x20 for toolbar buttons, 16x16 for the combo chevron. The Starship SVG files are not in the source tree, so `preview.html` draws simple 16x16 stroke icons that only approximate them.
- Which button is checked, hovered or pressed. The preview shows those states with `.is-checked`, `.is-hover` and `.is-pressed`. Real use binds them to `:hover` and a pressed pseudo state.
- The mode combo ("Select Mode") is a bare combo box, not a toolbar block. Use the `.toolBar-modes` rules, not `.toolBar-btn`.

## Metrics

Citations: `SC` is `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp`, `SS` is `Editor/EditorStyle/Private/StarshipStyle.cpp`.

| Part | Value | Source |
|---|---|---|
| Strip background | Panel | `SC:2200` |
| Strip padding (left/right, top/bottom) | 4, 6 | `SC:2205`, applied at `Runtime/Slate/Private/Framework/MultiBox/MultiBox.cpp:1350` |
| Strip height with a 28px block | 40 | derived: 28 + 2 x 6 |
| Icon size | 20x20 | `SC:2240` |
| Button inner padding | 8 horizontal, 4 vertical | `SC:2193` |
| Button pressed padding | 8, 5 top, 8, 3 bottom | `SC:2194` |
| Button block padding | 4 horizontal | `SC:2208` |
| Button height (icon only) | 28 | derived: 20 + 4 + 4 |
| Button foreground normal / hover / pressed | Foreground / ForegroundHover / ForegroundHover | `SC:2189-2192` |
| Button hover and pressed fill | Dropdown, radius 4 | `SC:1391-1392` |
| Label padding | 4 left | `SC:2214` |
| Label font | Normal, Roboto Regular 10pt = 13.333px | `SC:36` |
| Toggle block padding / inner padding | 8 horizontal / 8, 4 | `SC:2209`, `SC:2217-2218` |
| Toggle fill unchecked hover / checked / checked hover | Dropdown / Primary / PrimaryHover, radius 4 | `SC:1627-1632` |
| Toggle foreground checked | ForegroundHover | `SC:1636` |
| Combo block padding | 0 | `SC:2207` |
| Combo chevron | 16x16, margin 1 left, 2 right | `SC:1517`, `SC:2198` |
| Combo width (icon only) | 8 + 20 + 1 + 16 + 2 + 8 = 55 | derived |
| Separator | 2px wide, Recessed, block padding 4 horizontal, -5 vertical (38px tall) | `ToolBarStyle.cpp:25`, `SC:2210-2211` |
| Mode combo box | Input fill, InputOutline 1px, radius 4, padding 8, 1; icon 16, gap 6; hover outline Hover | `SC:1470-1472`, `CoreStyle.h:114,117-118`, `LevelEditorToolBar.cpp:1407-1411` |
| Play plate (left) | Dropdown, corners 4 0 0 4, padding 8, 2, 6, 2; block padding-left 10 | `SS:5520-5529` |
| Play foreground normal | AccentGreen `#8bc24a` | `SS:5542` |
| Play foreground hover | `#a9c296` (S halved in linear HSV) | `SS:5535-5536`, `SS:5544`; computed in `dev/hsv.js` |
| Play foreground pressed | `#658e34` (V halved) | `SS:5537`, `SS:5543` |
| Center plate (step, eject) | Dropdown, square, padding 2, 2, 6, 2 | `SS:5553-5561` |
| Stop plate foreground normal / hover / pressed | AccentRed `#ff4040` / `#ffc0c0` / `#bc2c2c` | `SS:5568-5578` |
| Overflow dots plate | Dropdown, corners 0 4 4 0, width 22, glyph 6x24, block padding 1 left, 8 right | `SS:5605-5620` |
| Overflow ("expand") button | combo with slim button style, content padding 4, 0 plus 8, 4 = 12, 4; glyph 16x16 | `SClippingHorizontalBox.cpp:116-131`, `SC:2206` |
| Settings block | right aligned, 7px from the right edge, label shown (Callout style) | `LevelEditorToolBar.cpp:1639`, `SC:2278-2283` |

Hover and pressed on a plate change only the foreground, because the plate brush is Dropdown in every state (`SS:5520-5523`).

## Do

- Keep every button 28px tall and let the strip supply the 6px top and bottom padding.
- Color only the Play (green) and Stop (red) glyphs. Every other glyph follows Foreground and ForegroundHover.
- Join the Play group as one rounded plate: left, center, center, right.

## Don't

- Do not give toggles a second visual for hover when checked. Checked hover is PrimaryHover and nothing else.
- Do not add a border to buttons. The look comes from the fill brush only.
- Do not use the plain `.toolBar-btn` look for the mode combo.

## Not found in source

- The disabled look of a button (opacity) is not in the files read.
- Exact glyph shapes of the Starship icons.
