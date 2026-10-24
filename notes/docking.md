# Docking: constants used

Source root: `/home/user/UE553/Engine/Source` (UE 5.5.3). `Core` = `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp`. Slate unit = 1px at 100% DPI.

## Colours (all tokens, from `SetupDockingStyles` unless noted)

| Name | Value | Source |
|---|---|---|
| Tab well fill, minor | `--background` | `Core:1795`; `Runtime/Slate/Private/Framework/Docking/SDockingTabStack.cpp:1235` |
| Tab well fill, under window chrome | `--title` | `SDockingTabStack.cpp:1234`; `Core:1117` |
| Content area, minor tab | `--panel` | `Core:1794` |
| Content area, major tab | `--background` | `Core:1820` |
| Tab fill, foreground | `--panel` (texture `DockTab_Foreground`, 4/20 slice) | `Core:1791`, `:1816` |
| Tab fill, hovered | `--panel` at opacity 0.8 | `Core:1790`, `:1815` |
| Tab fill, normal | none | `Core:1789`, `:1814` |
| Text, normal | `--foreground` | `Core:1801`, `:1827` |
| Text, active (minor / major) | `--foreground-hover` / `--white` | `Core:1802`, `:1828` |
| Text, foreground (minor / major) | `--foreground` / `--white` | `Core:1803`, `:1829` |
| Text, hovered (minor / major) | `--foreground-hover` / `--white` | `Core:1804`, `:1830` |
| Close glyph normal / hovered | `--foreground` / `--foreground-hover` | `Core:1777-1779` |
| Active tab line | `--primary`, gradient transparent / primary / transparent | `Core:1839`; `SDockTab.cpp:592-594` |
| Flash colour | `SelectionColor` `#18A0FB` (literal, not a token) | `Core:63`, `:1774` |
| Splitter normal / highlight | `--background` / `--secondary` | `Core:634-635` |
| SplitterPanel normal / highlight | `--panel` / `#606060` literal | `Core:638-639` |
| Window background | `--recessed` | `Core:780` |
| Window border stroke | `--window-border`, 2px, radius 2 | `Core:781` |
| Window outline stroke | `--input-outline`, 1px, radius 2 | `Core:782` |
| Window button glyph normal / hover | `--foreground` / `--foreground-hover` | `Core:749-766` |
| Min/max hover fill | white alpha 40/255 | `Core:789-790` |
| Close hover fill | `FColor(255,20,20,150)` reinterpreted linear, about rgb(255,79,79) alpha 0.588 (derived) | `Core:791-792`; `Runtime/SlateCore/Public/Rendering/ElementBatcher.h:281-286` |
| Project badge text | `--foreground` | `Editor/LevelEditor/Private/LevelEditor.cpp:123` |
| Project badge fill | `Colors.Title` tint over an absent texture; screenshot shows `#0f0f0f` (literal used) | `LevelEditor.cpp:107` |

## Metrics

| Name | Value | Source |
|---|---|---|
| Minor tab padding | (4, 3, 10, 4) | `Core:1798` |
| Major tab padding | (4, 4, 10, 4) | `Core:1823` |
| Vertical padding scale | 0.85 | `Runtime/Slate/Private/Widgets/Docking/SDockTab.cpp:30`, `:811-816` |
| Overlap width | -2 both roles | `Core:1799`, `:1824`; `SDockingTabWell.cpp:105` |
| Max tab size | minor (160, 25), major (210, 50) | `Runtime/Slate/Private/Framework/Docking/SDockingTabWell.cpp:9-10` |
| Tab icon size | 16 x 16 (FDockTabStyle default) | `Runtime/SlateCore/Private/Styling/SlateTypes.cpp:707` |
| Icon border padding | minor 1 (default), major 4 | `SlateTypes.cpp:713`; `Core:1832` |
| Icon slot right padding | 5 | `SDockTab.cpp:646` |
| Label padding | 1 + 1 vertical | `SDockTab.cpp:665`, `:676` |
| Close button content padding | (0, 1.5, 0, 0) | `SDockTab.cpp:707` |
| Close glyph | `close-small` 16 x 16 | `Core:1777` |
| Colour icon cell radius (major) | 4 | `Core:1819` |
| Active line height | 1 | `SDockTab.cpp:616` |
| Flash timing | 2 per second, 1s | `SDockTab.cpp:20-24`, `:529-544` |
| Tab content padding default | 0 | `Runtime/Slate/Public/Widgets/Docking/SDockTab.h:77` |
| Splitter thickness | 5 physical, 5 hit-test | `Runtime/Slate/Public/Widgets/Layout/SSplitter.h:179-180` |
| Window border padding | 3 | `Core:785` |
| Window corner radius | 2 (notification 8) | `Core:784`, `:797` |
| Window button size | 42 x 23 | `Core:749-766` |
| App icon | 45 x 45 white, padding 5; icon cell bottom margin 4 | `Core:284-285`; `Runtime/Slate/Private/Framework/Application/SWindowTitleBar.cpp:206` |
| Small app icon | 24 x 24, padding (4,4,0,0) | `Core:290-291` |
| Menu row / tab row offset | 25 top; 45+12 = 57 left | `SDockingTabStack.cpp:891`, `:893`, `:897-898` |
| Right content left padding | 2 | `SWindowTitleBar.cpp:235` |
| Centre title padding | (5, 2, 5, 2) | `SWindowTitleBar.cpp:291` |
| Badge padding | (32, 6, 32, 7) | `Editor/EditorStyle/Private/StarshipStyle.cpp:2917` |
| Badge slice | 6/16 of a 16px texture | `StarshipStyle.cpp:2916` |
| Badge outer spacing | right 2 (box), right 8 (slot) | `LevelEditor.cpp:166`, `:247` |
| Text | NormalText = Roboto Regular 10pt = 13.333px | `Core:36` |

## Derived, not read directly

- Small tab height 25: the clamp `MaxMinorTabSize.Y`. The natural height (icon cell 18, label 2 + about 15.6 + 2, close 17.5, plus 2.55 + 3.4 padding) is about 25.6 using an assumed Roboto line height of 1.17 em, so the clamp binds.
- Major tab height about 30.8: icon cell 24 + 2 x 3.4. It is under the 50 clamp.
- Title area 59: icon cell 55 + 4 bottom margin. The right content (badge 28.6 tall) is shorter.
- Close hover rgb(255,79,79): sRGB encoding of linear 20/255.

## Not found

- Texture files: `DockTab_Foreground`, `ProjectBadge/Badge`, and all Starship SVGs (`close-small`, `UELogo`, window `minimize` / `maximize` / `restore` / `close`, tab icons). Corner radius 4 for tabs and 6 for the badge come from the texture margin fractions (`4/20`, `6/16`), not from the image.
- The title text (`NormalText`) of a window without a menu bar was not rendered. Only its padding is documented.
- Menu bar styling lives in the menu bar area, not here. The menu strip in the preview is a stand-in.
- 5.5.3 sets `ColorOverlayTabBrush` to `FSlateNoResource` (`Core:1792`), so the tab flash draws nothing in 5.5.3. 5.8.1 (`git show HEAD:Engine/Source/Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp`, line 1882) uses `FSlateColorBrush(FStyleColors::Foreground)`. The preview shows the 5.8.1 look with the 5.5.3 flash colour.
- `Docking.Tab.InactiveTabSeparator` (`Core:1837`) exists but the tab well sets `SeparatorBrush = nullptr` (`SDockingTabWell.cpp:31`), so no separator is drawn.
- `SlateEditorStyle.cpp:3080-3088` carries a legacy `Docking.Tab.*` set (padding 5,2,5,2 and similar). Its own comment says the current style is `Docking.Tab` in the core style, and `SDockTab` reads `FDockTabStyle` from `FAppStyle` (`SDockTab.cpp:583-584`). No editor override of `Docking.Tab` or `Docking.MajorTab` was found in `StarshipStyle.cpp`.
- Editor settings can recolour the window title area (`bEnableEditorWindowBackgroundColor`, `StarshipStyle.cpp:152-163`). Defaults are used here.
- `FDockingConstants` max sizes apply at layout time. They were not checked against screenshots. By about 1.2 to 1.3 from 100% DPI, the reference screenshot is scaled, so pixel values from it were used for colour sampling only (title strip `#151515`, tab `#242424`, window edge `#101010`).
