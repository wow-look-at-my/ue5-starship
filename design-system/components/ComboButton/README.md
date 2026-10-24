# ComboButton

A dark input-style button with a trailing caret that opens a popup. `ComboBox` rows and `SimpleComboButton` (borderless) share the same parts.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (`SetupComboButtonStyles`, lines 1467-1569), abbreviated `SCS`. This also covers margins in `Runtime/SlateCore/Public/Styling/CoreStyle.h`, abbreviated `CS.h`. This also covers layout in `Runtime/Slate/Private/Widgets/Input/SComboButton.cpp`. The editor only derives variants (`StarshipStyle.cpp:3228-3233` category combo, `:3330-3334` name-area combo).

## What the consumer provides

- The label content. `ComboButton` content padding is 0 (`SCS:1490`). The label sits directly at the button padding.
- The popup content (`MenuContent`). The popup is not part of the button style. A `ComboBox` fills it with rows.
- The caret is part of the style. The SVG `Starship/CoreWidgets/ComboBox/wide-chevron-down` is not available, so `preview.html` draws an approximation.

## Metrics

Slate unit = 1px. The 16px text line box is derived from Roboto metrics, not read from source.

| Property | Value | Source |
|---|---|---|
| Fill (all states except disabled) | `--input` | `SCS:1471-1473` |
| Radius | 4px | `SCS:1471`, `CS.h:117` |
| Outline normal | 1px `--input-outline` | `SCS:1471`, `CS.h:118` |
| Outline hovered and pressed | 1px `--hover` | `SCS:1472-1473` |
| Disabled brush (style) | fill `--dropdown`, outline `--dropdown-outline` | `SCS:1474` |
| Disabled look (engine default) | normal brush at 45% alpha | `SlateElementPixelShader.usf:535` |
| Foreground normal | `--foreground` | `SCS:1475` |
| Foreground hovered, pressed, disabled | `--foreground-hover` | `SCS:1476-1478` |
| Button padding normal | 8 left/right, 1 top/bottom | `CS.h:114` |
| Button padding pressed | 8, top 2, bottom 0 | `CS.h:115` |
| Content padding | 0 | `SCS:1490` |
| Caret image | 16x16 | `SCS:1491` |
| Caret padding | 2 on every side (class default) | `SlateTypes.cpp:165` |
| Caret vertical alignment | centre | `SlateTypes.cpp:166` |
| Resulting height | 22px: 16px caret + 2 + 2 padding + 1 + 1 | derived |
| Caret colour | inherits the button foreground | `SComboButton.cpp:82` |
| Popup fill | `--dropdown`, radius 0 | `SCS:1492` |
| Popup outline | 1px `--dropdown-outline` | `SCS:1492` |
| Popup padding | 0 | `SCS:1493` |
| ComboBox row padding | 8 left/right, 3 top/bottom | `SCS:1503` |
| ComboBox row hovered fill | `--primary`, full row, no radius | `SCS:1534-1547` |
| ComboBox row text | `--foreground-hover` (white) | `SCS:1549-1550` |
| ComboBox row keyboard focus | 1px `--select` ring, radius 4, transparent fill | `SCS:1539` |
| ComboBox active and selected row | no brush | `SCS:1541` |
| SimpleComboButton button | `SimpleButtonLabelAndIcon`: no fill; `--dropdown` r4 on hover; padding 4 x 1 | `SCS:1511-1521`, `1389-1403` |
| SimpleComboButton foreground | `--foreground`, `--foreground-hover` hovered | `SCS:1394-1396` |
| SimpleComboBox row padding | 8 left/right, 2 top/bottom | `SCS:1528` |

## Open state

The source has no separate open brush. The button uses click method MouseDown (`SComboButton.cpp:35`), so the pressed brush (outline `--hover`, padding shift) is what shows while the popup opens. `preview.html` shows that look with the popup below.

## Do

- Use `ComboButton` for a value picker. Use `SimpleComboButton` for a menu opener inside a toolbar.
- Keep the caret on the right, 20px wide including padding.
- Let the hovered row fill the whole popup width.

## Don't

- Do not draw a separate selected-row highlight. The `ComboBox.Row` style has none.
- Do not add a gap or shadow between the button and the popup. The source defines none.
- Do not give the popup rounded corners. The popup brush radius is 0.
