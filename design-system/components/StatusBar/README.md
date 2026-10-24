The 32px editor status bar. Panel segments separated by 1px gaps. That Panel is with drawer buttons and the Cmd console on the left and the Derived Data and Source Control combos on the right.

## What the consumer provides

- Segment content: drawer buttons (`.statusBar-btn`), the console (`.statusBar-console`), a message area (`.statusBar-seg--message`, empty in the preview) and the status combos (`.statusBar-combo--status`).
- Inline SVG icons at 16x16. The Starship SVG files are not in the source tree, so `preview.html` draws simple stroke icons that only approximate them.
- The bar width. The console box is at least 300px wide. The bar needs about 990px to show every segment.

## Metrics

Citations: `SC` is `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp`, `SB` is `Editor/StatusBar/Private/SStatusBar.cpp`, `WD` is `Developer/ToolWidgets/Private/SWidgetDrawer.cpp`, `SU` is `Editor/StatusBar/Private/StatusBarSubsystem.cpp`.

| Part | Value | Source |
|---|---|---|
| Bar height | 32 | `SC:1883`, `SB:584` |
| Segment fill | Panel | `SB:580` |
| Gap between segments | 1 | `SB:597`, `SB:610`, `SB:622`, `WD:589` |
| Gap colour | not set in source; the preview uses Background | assumption |
| Drawer button segment padding | 2 horizontal | `WD:443` |
| Drawer button style | no fill, Foreground normal, ForegroundHover on hover and press, padding 2 (pressed 2, 3, 2, 1) | `SC:1867-1870`, `SC:237-239` |
| Drawer button content | 16x16 icon, label Normal font, each with 2px margin | `WD:456`, `WD:467`, `SU:489`, `SU:546` |
| Content Drawer label / Output Log label | "Content Drawer" / "Output Log" | `SU:487`, `SU:544` |
| Message segment padding | 6 horizontal | `SB:602` |
| Console segment | slot padding 2 left, border padding 2; inner Panel border padding 6 horizontal | `WD:506`, `WD:509`, `SU:524-527` |
| Cmd combo | SimpleComboButton, icon 16 and label with 2px margins, 4px gap before the text box | `SOutputLog.cpp:186-213` |
| Combo button look | no fill, hover and press Dropdown radius 4, padding 4, 1; chevron 16x16 with 2px margin | `SC:1389-1403`, `SC:1514-1521`, `SlateTypes.cpp:165` |
| Console text box | Input fill, InputOutline 1px, radius 4, padding 8, 3, 8, 4; width 300 to 600; font Mono 9pt = 12px | `SC:1282-1294`, `SOutputLog.cpp:220-221`, `OutputLogStyle.cpp:54`, `OutputLogSettings.h:40` |
| Console hint text | "Enter Console Command" is the preview text; colour is Foreground at alpha 0.35 | `SlateEditableTextLayout.cpp:3563` |
| Status combo content padding | 6 horizontal on top of the combo button padding (10 total) | `SDerivedDataStatusBar.cpp:166`, `SourceControlMenuHelpers.cpp:432` |
| Derived Data | icon, 3px gap, label, 10px after the label | `SDerivedDataStatusBar.cpp:177`, `:224` |
| Source Control | icon, 5px gap, label | `SourceControlMenuHelpers.cpp:449` |
| Right cluster padding | 4 horizontal | `SC:1897` |

## Do

- Keep each segment a flat Panel rectangle with no radius. Only the buttons inside radius 4.
- Let the message segment take the free width.

## Don't

- Do not give drawer buttons a hover fill. They only turn white.
- Do not set the console box narrower than 300px.

## Not found in source

- The colour of the 1px gaps (they show what is behind the bar).
- The Derived Data and Source Control badge overlays (idle, busy, warning) are drawn from SVG files not in the tree. The preview shows only the base glyphs.
