# DockTab

A docking tab: the small panel tab (`Docking.Tab`) and the major app tab (`Docking.MajorTab`) with icon, label and close button, drawn by `SDockTab`.

## What the consumer provides

- A label, an optional 16px icon and a role (small or major). The role picks the style set.
- The state: `normal`, `hovered`, `foreground` (selected tab of its stack), `active` (the foreground tab of the focused stack). Priority for the fill is foreground, then hovered, then none. Priority for the text colour is active, then hovered, then foreground, then normal (`SDockTab.cpp:233-256`, `:794-808`).
- A tab well to sit on and a content area to join (see `TabWell`). The active tab uses the same fill as its content area, so the two read as one shape.
- Icons: the Starship SVG files are not in the source tree. The preview draws simple 16x16 stroke icons as stand-ins.

## Metrics

Slate unit = 1px at 100% DPI. Text is `NormalText`: Roboto Regular 10pt = 13.333px (`StarshipCoreStyle.cpp:36`, `:1805`).

| Property | Minor tab | Major tab | Source |
|---|---|---|---|
| Tab padding (L, T, R, B) | 4, 3, 10, 4 | 4, 4, 10, 4 | `StarshipCoreStyle.cpp:1798`, `:1823` |
| Vertical padding scale | x0.85, so top 2.55, bottom 3.4 | x0.85, so 3.4 and 3.4 | `SDockTab.cpp:30`, `:811-816` |
| Overlap width | -2 (2px gap between tabs) | -2 | `StarshipCoreStyle.cpp:1799`, `:1824`; `SDockingTabWell.cpp:105` |
| Max size | 160 x 25 | 210 x 50 | `SDockingTabWell.cpp:9-10` |
| Height | 25 (the max clamp binds; derived natural height is about 25.6) | about 30.8 (derived: icon cell 24 + 2 x 3.4) | `SDockingTabWell.cpp:9`, `:281-282` |
| Icon size | 16 x 16 | 16 x 16 | `SlateTypes.cpp:707` (default, never overridden) |
| Icon cell padding | 1 (default) | 4 | `SlateTypes.cpp:713`; `StarshipCoreStyle.cpp:1832` |
| Icon to label gap | 5 | 5 | `SDockTab.cpp:646` |
| Label vertical padding | 1 + 1 | 1 + 1 | `SDockTab.cpp:665`, `:676` |
| Close glyph | `close-small`, 16 x 16 | same | `StarshipCoreStyle.cpp:1777` |
| Close button content padding | 0, 1.5, 0, 0 | same | `SDockTab.cpp:707` |
| Active-tab line | 1px high, full tab width | none (minor only) | `SDockTab.cpp:610-619`, `:833-836` |
| Tab corner radius | 4 (slice of the texture; approximated) | 4 | `StarshipCoreStyle.cpp:1791` (4/20 slice) |
| Colour-coded icon cell radius | none | 4 | `StarshipCoreStyle.cpp:1819` |

## Colours per state

| State | Fill | Text and icon | Close button |
|---|---|---|---|
| normal | none | `--foreground` (minor and major) | hidden, space kept |
| hovered | `--panel` at 80% opacity | `--foreground-hover` (minor), `--white` (major) | `--foreground`, visible |
| foreground | `--panel` | `--foreground` (minor), `--white` (major) | `--foreground`, visible |
| active | `--panel` plus a 1px line, transparent to `--primary` to transparent | `--foreground-hover` (minor), `--white` (major) | `--foreground`, visible |
| close hovered | unchanged | unchanged | `--foreground-hover` |
| flash | `#18A0FB` at the flash alpha (see below) | unchanged | unchanged |

Sources: `StarshipCoreStyle.cpp:1790-1791` (fills), `:1801-1804` and `:1827-1830` (text), `:1776-1779` (close), `:1839` (line colour), `SDockTab.cpp:970-976` (close visible while hovered or foreground).

- The close button is `Hidden`, not `Collapsed`, so an unselected tab keeps its width.
- The icon follows the text colour. A consumer icon colour is dimmed to 70% opacity unless the tab is foreground or hovered (`SDockTab.cpp:838-852`).
- Flash colour is `SelectionColor` `#18A0FB` (`StarshipCoreStyle.cpp:63`, `:1774`), alpha `sin * fade` over 1s at a set number of flashes per second (`SDockTab.cpp:20-24`, `:529-544`). Version 5.5.3 sets the overlay brush to `FSlateNoResource` (`StarshipCoreStyle.cpp:1792`), so the flash draws nothing in 5.5.3. Version 5.8.1 sets it to a `Foreground` colour brush. The preview shows the 5.8.1 behaviour at peak alpha. The colour is the 5.5.3 `FlashColor`.
- A major tab can show a colour-coded icon cell (`ColorOverlayIconBrush`, `Foreground` coloured, radius 4) when the consumer sets a tab colour with alpha above zero (`SDockTab.cpp:824-831`). The tint is consumer data. The orange in the preview is illustrative.

## Do

- Use `--panel` for the selected tab so it joins the content area below it.
- Show the close button only on the hovered or selected tab, and keep the space for it on the others.
- Use the active line only on a small tab in the focused stack.

## Don't

- Do not draw a separator between tabs. `SeparatorBrush` is null in the tab well (`SDockingTabWell.cpp:31`). The `Docking.Tab.InactiveTabSeparator` style entry (`StarshipCoreStyle.cpp:1837`) is not used by the widget.
- Do not give a major tab the active line. `GetActiveTabIndicatorVisibility` collapses it for `MajorTab`.
- Do not use a literal grey for the fills. The legacy `DockColor_*` locals (`StarshipCoreStyle.cpp:1782-1784`) are unused.
- The 4px corner radius comes from a texture slice that is not in the tree. Treat it as approximate.
