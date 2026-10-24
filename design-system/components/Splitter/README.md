# Splitter

The resize handle of an `SSplitter`, as used between docked panels: a 5px bar that is `--background` at rest and `--secondary` while hovered or dragged.

## What the consumer provides

- The panes on either side and the orientation. The handle fills the gap the splitter reserves between them.
- Nothing else. The docking splitter (`SDockingSplitter`) creates a plain `SSplitter` with only an orientation (`SDockingSplitter.cpp:15-17`). It takes every default below.

## Metrics

| Property | Value | Source |
|---|---|---|
| Handle thickness | 5 | `SSplitter.h:179` (`PhysicalSplitterHandleSize`), `SSplitter.cpp:286`, `:291` |
| Hit-test thickness | 5 | `SSplitter.h:180` (`HitDetectionSplitterHandleSize`) |
| Handle length | the full extent of the pane edge | `SSplitter.cpp:286`, `:291` |
| Handle fill, normal | `--background` | `StarshipCoreStyle.cpp:634` |
| Handle fill, highlight (hovered or dragged) | `--secondary` | `StarshipCoreStyle.cpp:635`, `SSplitter.cpp:295-304` |
| Style name | `Splitter` | `SSplitter.h:176` |
| Corner radius | none, flat colour brushes | `StarshipCoreStyle.cpp:634-635` |

### Variants

| Style | Normal | Highlight | Source |
|---|---|---|---|
| `SplitterPanel` | `--panel` | `#606060` (literal `FColor(96,96,96)`) | `StarshipCoreStyle.cpp:637-640` |
| `SplitterDark` (editor only) | `#202020` (literal) | `#606060` (literal) | `StarshipStyle.cpp:811-815` |

## How the brushes are used

`SSplitter::OnPaint` swaps the brushes and multiplies each by the other's tint (`SSplitter.cpp:295-316`). The renderer takes the colour from the tint argument and ignores the brush colour. The result is the intended one: the normal tint at rest, the highlight tint while hovered. A consumer that reuses the brushes elsewhere must not assume the brush colour is what the splitter draws.

## Do

- Use the default `Splitter` style between docked panels. A `--background` bar on `--panel` panes reads as a gap.
- Keep the 5px thickness. Pane sizes in a layout are saved as fractions and the handle space is subtracted before they are applied (`SSplitter.cpp:145`).
- Use `SplitterPanel` only where the panes sit directly on `--panel` and the bar must not show at rest.

## Don't

- Do not draw a border or a grip glyph on the handle.
- Do not make the bar thinner and widen only the hit area. The editor uses the same value for both.
