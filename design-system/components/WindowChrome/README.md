# WindowChrome

The custom title bar and frame of an editor window: app icon, a menu strip slot, an optional project badge, and minimize. This also covers maximize and close buttons inside a two-stroke window border.

Built from the other components:

- 3 `Button` (`button--caption`, `button--caption-close` on the last) for minimize, maximize or restore, and close. The caption variant is the 42 x 23 glyph cell with the translucent hover fill. 1 more `Button` (default look) brings back a hidden window.
- 1 `TabWell` major tab (the single static major tab markup, with no `ue-tab-well` element) for the title-bar tab. No tab CSS is copied.
- 1 `MenuBar` (`ue-menu-bar`) in the menu strip slot. Its look and behaviour belong to the `MenuBar` component.

The window keeps only its own frame, title area layout, app icon, project badge and focus state.

## What the consumer provides

- The menu strip content (`WindowMenuSlot`, `SWindowTitleBar.cpp:219`). The preview nests the `ue-menu-bar` component. The menu bar owns its own spacing and styling.
- The major tab row. The docking area reserves space for it below the menu (`SDockingTabStack.cpp:891-898`).
- Optional right-side content next to the buttons (`UpdateBackgroundContent`). The level editor puts the project badge there (`LevelEditor.cpp:234-253`).
- A title text only for windows without a menu bar. The centred title is an `SBox` with padding 5, 2, 5, 2 and `NormalText` (`SWindowTitleBar.cpp:291`). The editor main window shows the project badge instead.
- Icons: the Starship SVG files are not in the tree. The preview draws a circle-and-U logo and line glyphs as stand-ins.

## Metrics

Slate unit = 1px at 100% DPI.

| Property | Value | Source |
|---|---|---|
| Window background | `--recessed` | `StarshipCoreStyle.cpp:780` |
| Window border | rounded box, fill `--recessed`, radius 2, 2px stroke `--window-border` | `StarshipCoreStyle.cpp:781` |
| Window outline | rounded box, radius 2, 1px stroke `--input-outline`, inset 2px | `StarshipCoreStyle.cpp:782`; `SWindow.cpp:597-600` |
| Border padding (content inset) | 3 on every side | `StarshipCoreStyle.cpp:785` |
| Corner radius | 2 (notification window: 8) | `StarshipCoreStyle.cpp:784`, `:797` |
| Child window background | `--recessed` | `StarshipCoreStyle.cpp:783`, `:801` |
| Title bar fill | none (`FSlateNoResource` for active and inactive) | `StarshipCoreStyle.cpp:777-778` |
| Title area fill with a major tab stack | `--title` | `SDockingTabStack.cpp:1234` |
| App icon | 45 x 45, tint `--white` | `StarshipCoreStyle.cpp:284` |
| App icon padding | 5 on every side, plus 4 below the icon cell | `StarshipCoreStyle.cpp:285`; `SWindowTitleBar.cpp:206` |
| Small app icon (no menu bar) | 24 x 24, tint `--foreground`, padding 4, 4, 0, 0 | `StarshipCoreStyle.cpp:290-291` |
| Title area height | the taller of left and right content; the icon cell gives 59 | `SWindowTitleBar.cpp:321` |
| Menu row height | 25 | `SDockingTabStack.cpp:891`, `:897` |
| Major tab row | starts 25 below the top and 57 from the left (icon 45 + 12) | `SDockingTabStack.cpp:893`, `:897-898` |
| Window button size | 42 x 23, top-aligned, no gap between buttons | `StarshipCoreStyle.cpp:749-766`; `SWindowTitleBar.cpp:246-262` |
| Right content padding | 2 on the left | `SWindowTitleBar.cpp:235` |
| Button glyph colour | `--foreground`, `--foreground-hover` on hover | `StarshipCoreStyle.cpp:749-751` |
| Minimize / maximize / restore hover fill | white at alpha 40/255 (0.157) | `StarshipCoreStyle.cpp:789-790` |
| Close hover fill | `FColor(255,20,20,150)`, rendered as about `rgb(255,79,79)` at alpha 0.588 | `StarshipCoreStyle.cpp:791-792` |
| Project badge padding | 32, 6, 32, 7 | `StarshipStyle.cpp:2917` |
| Project badge text | `NormalText`, `--foreground` | `StarshipStyle.cpp:2915`; `LevelEditor.cpp:123` |
| Project badge outer spacing | 2 right (box), 8 right (slot) | `LevelEditor.cpp:166`, `:247` |
| Project badge shape | 16px box texture, 6px slices | `StarshipStyle.cpp:2916` |
| Flash | white, alpha up to 0.4, over 1s at 5.5 pulses per second | `SWindowTitleBar.cpp:567`, `SWindowTitleBar.h:33`, `:36` |
| Mac | system traffic-light buttons replace the three buttons | `SWindowTitleBar.cpp:133` |

- The close hover colour is derived. `FSlateColorBrush(FColor)` reinterprets the bytes as a linear colour, and slate packs vertex colours to sRGB, so the green and blue channels (20/255 linear) display as about 79. The red channel and the alphas are exact.
- The project badge fill is `Colors.Title` (`--title`) tinted over a texture that is not in the tree. The reference screenshot shows `#0f0f0f`, so the preview uses that literal for the badge.
- The `unreal-small` and `UELogo` logo files are absent. Treat the logo drawing as a placeholder.

## Do

- Top-align the buttons and make each exactly 42 x 23.
- Let the title area grow with its tallest content. Reserve room for the menu strip, then the major tab row, inside it.
- Keep the window frame as multiple strokes: `--window-border` outside, `--input-outline` inside.

## Don't

- Do not give the title bar its own fill. The `--title` ground comes from the tab stack behind it.
- Do not use a red token for the close button fill. The source uses a translucent literal.
- Do not add a divider between the title area and the dock area.
