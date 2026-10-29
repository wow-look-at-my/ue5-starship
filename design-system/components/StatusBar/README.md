The 32px editor status bar. Panel segments separated by 1px gaps. That Panel is with drawer buttons and the Cmd console on the left and the Derived Data and Source Control combos on the right.

## Composed from

| Primitive | Count | Role |
|---|---|---|
| `ue-button` with `button--status` | 2 | Content Drawer and Output Log. `aria-pressed` is the open state |
| `ue-combo-button` with `combobutton--simple`, value mode | 1 | The Cmd executor. The label follows the pick |
| `ue-combo-button` with `combobutton--simple combobutton--wide`, action mode | 2 | Derived Data and Source Control |
| `ue-popup-menu` | 3 | The upward panel of each combo (`combobutton-menu--up`) |
| `ue-text-input` with `textinput--console` | 1 | The console command line |

The composite adds only layout: the bar, the segments, the console segment and the anchors. It listens to the primitives for the drawers, the executor and the command history.

## What the consumer provides

- Segment content: drawer buttons, the console (`.statusBar-console`), a message area (`.statusBar-seg--message`, empty in the preview) and the status combos.
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

## Live behaviour

`<ue-status-bar>` (`src/StatusBar/StatusBar.ts`, built to `StatusBar.js`) wraps a `.statusBar` and the `.statusBar-history` above it.

- A drawer button toggles `aria-pressed`, which is the `ue-button` behaviour. The bar clears the other drawer, so one drawer is open at a time (`SWidgetDrawer.cpp:527`, `:618`). The source has no open style for the button, so the pressed state reuses the pressed look: ForegroundHover and padding 2, 3, 2, 1 (`SC:1867-1870`).
- The Cmd combo opens its panel upward, because the bar is at the bottom of the window. Choosing a row renames the combo, which is the value mode of the combo. The engine fills this menu with the command executors (`SOutputLog.cpp:192`, `:733`). Cmd and Python are illustrative.
- Derived Data and Source Control open an upward panel as well. Their entries are illustrative, because the source builds those menus at run time.
- The console box is the real input of the `ue-text-input`. Focus draws the Primary outline and white text (`SC:1285`, `SC:1292`). Enter appends `> command` to the history (a few lines at most) and empties the box. Up and Down recall earlier commands. A blank line does nothing. The bar reads those keys on the input.
- Events: `ue-drawer-change`, `ue-executor-change`, `ue-command`. A bar with `data-pinned` stays plain HTML.

## Not found in source

- The colour of the 1px gaps (they show what is behind the bar).
- The Derived Data and Source Control badge overlays (idle, busy, warning) are drawn from SVG files not in the tree. The preview shows only the base glyphs.
