# SegmentedControl

A single-choice button group on an `--input` track, used for Mobility (Static / Stationary / Movable): the checked segment is raised in `--dropdown`.

## What the consumer provides

- The list of segments (text, optional icon, tooltip) and the current value.
- A value-changed handler. Without multi-select, one segment is always checked.
- Segment content. For Mobility the text uses the Small font with letter spacing 100. The generic default text style is Normal 10pt.

## Metrics

| Part | Value | Source |
|---|---|---|
| Track | `--input` fill, radius 4 | `StarshipCoreStyle.cpp:1684`, `CoreStyle.h:117` |
| Track padding | right 1 (the grid cells carry the left, top and bottom 1) | `SSegmentedControl.h:304-309`, `StarshipCoreStyle.cpp:1685` |
| Cell layout | equal-width uniform grid, slot padding 1 left, 1 top, 1 bottom, 0 right | `SSegmentedControl.h:219-220` |
| Segment padding | 8 horizontal, 3 vertical | `StarshipCoreStyle.cpp:1662,1678` |
| Segment shape | radius 4 on every segment (first, middle and last share one style) | `StarshipCoreStyle.cpp:1667-1671,1680-1683` |
| Unchecked | no fill; hovered `--hover`; pressed `--header` | `StarshipCoreStyle.cpp:1666-1668` |
| Checked | `--dropdown`; hovered `--hover`; pressed `--header` | `StarshipCoreStyle.cpp:1669-1671` |
| Text colour | `--foreground` unchecked; `--foreground-hover` when hovered, pressed or checked | `StarshipCoreStyle.cpp:1672-1677` |
| Mobility font | Small 8pt = 10.667px, letter spacing 100 = 0.1em | `StarshipStyle.cpp:3127-3130`, `SlateTextShaper.cpp:412` |
| Clipping | each segment clips to its bounds; long labels cut off, no ellipsis | `SSegmentedControl.h:289` |
| Row context | Mobility sits in a normal property row; the control fills the value column | `MobilityCustomization.cpp:52-72` |
| Row height | min 26 plus 1px line; segment height = text line + 6, track adds 2 | `SDetailSingleItemRow.cpp:732-738` |

## Do

- Use `--dropdown` for the checked segment. It is a grey lift, not the accent colour.
- Keep segment widths equal.
- Give each segment a tooltip. Mobility does.

## Don't

- Do not use `--primary` for the checked segment on this control. A different style set (the later-defined "SegmentedCombo.Left" and the filter pills) uses Primary. The control used by Details copies the first definition, whose checked brush is Dropdown. The reference screenshot sampled `#383838` for the checked segment.
- Do not round only the outer corners. Every segment is a full rounded rectangle.
- Do not bold the checked label. Only the colour changes.
