# Tooltip

A small flat popup with multiple forms. A dark custom-content tooltip (fill `--dropdown`, 1px outline) and the text-only tooltip, which paints a light textured background with black text.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (SToolTip block, lines 491-498), abbreviated `SCS`. This also covers layout in `Runtime/Slate/Private/Widgets/SToolTip.cpp` and `Runtime/Slate/Public/Widgets/SToolTip.h`. The editor documentation tooltip (`Editor/Documentation/Private/Documentation.cpp`) wraps the same widget.

## What the consumer provides

- Either a plain text (text-only form) or a content widget (custom form).
- For a command tooltip: the description and the key binding text (`UICommandInfo.cpp:165-192`).
- The texture `Old/ToolTip_BrightBackground` is not available in this checkout. The text-only form in `preview.html` fills with `--foreground` as an approximation. The real surface colour and edge shape are unknown.

## Metrics

Slate unit = 1px. The 14px text line box is derived from Roboto metrics, not read from source.

| Property | Value | Source |
|---|---|---|
| Font (`ToolTip.Font`) | Regular 9pt = 12px | `SCS:493`; `SToolTip.h:29` |
| Larger font (`ToolTip.LargerFont`) | Normal: 10pt = 13.33px, used by curve editor tips | `SCS:496` |
| Custom-content fill (`ToolTip.Background`) | `--dropdown` | `SCS:494` |
| Custom-content outline | 1px `--dropdown-outline` | `SCS:494` |
| Custom-content radius | 0 | `SCS:494` |
| Custom-content padding (`TextMargin`) | 8 on every side | `SToolTip.h:30`; `SToolTip.cpp:48-57` |
| Text colour, custom content | white: the default widget foreground, no border overrides it | `WidgetStyle.h:21`; `UICommandInfo.cpp:182` |
| Key binding line | foreground at 60% alpha | `UICommandInfo.cpp:189`; `WidgetStyle.cpp:11` (`SubdueAmount` 0.6) |
| Gap between description and key binding | 4px | `UICommandInfo.cpp:177` |
| Text-only background (`ToolTip.BrightBackground`) | texture `Old/ToolTip_BrightBackground`, 8/64 box margin | `SCS:497`; `SToolTip.cpp:75` |
| Text-only padding | 11 on every side | `SToolTip.cpp:76` |
| Text-only text colour | black | `SToolTip.cpp:67` |
| Wrap width | 1000 units (console variable `Slate.ToolTipWrapWidth`) | `SToolTip.cpp:9-12` |
| Documentation tooltip | outer `ToolTip.BrightBackground`, inner padding 9, key binding chip `--hover-2` r4, chip padding 4 x 2 | `Documentation.cpp:228`; `SDocumentationToolTip.cpp:157`, `189`; `DocumentationStyleSet.cpp:47` (not drawn) |

## Do

- Use the dark form when the tooltip carries a content widget, such as a description and a key binding.
- Dim the key binding to 60%, as the source does.
- Let long text wrap at the wrap width.

## Don't

- Do not add rounded corners to the dark form. Its radius is 0.
- Do not give the dark form a shadow. The brush has none.
- Do not treat the light fill in `preview.html` as a measured colour. It is an approximation.
