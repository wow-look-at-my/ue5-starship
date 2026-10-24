# FilterPills

The strip of the tab of the Details panel section: toggle pills that wrap onto several lines, with the active pill filled in Primary.

## What the consumer provides

- The list of section names. Source sorts General first, All last, the rest alphabetical.
- The checked state of each pill. Exactly one pill is normally checked. The strip hides when the selection has no sections.
- A click handler per pill.

## Metrics

| Part | Value | Source |
|---|---|---|
| Strip background | `--panel` | `SDetailsView.cpp:391-395` |
| Strip padding | 8 left, 2 top, 8 right, 7 bottom | `SDetailsView.cpp:374` |
| Gap between pills | 4 horizontal, 4 vertical (wrap box inner slot padding) | `SDetailsView.cpp:379` |
| Pill style | "DetailsView.SectionButton" = FilterBar.BasicFilterButton | `StarshipStyle.cpp:3252`, `StarshipCoreStyle.cpp:922-930` |
| Pill padding | 16 horizontal, 4 vertical | `StarshipCoreStyle.cpp:929` |
| Pill shape | radius 4, 1px `--input` outline drawn inside the box | `StarshipCoreStyle.cpp:923-928` |
| Unchecked fill | `--header`; hovered and pressed `--hover` | `StarshipCoreStyle.cpp:923-925` |
| Checked fill | `--primary`; hovered and pressed `--primary-hover` | `StarshipCoreStyle.cpp:926-928` |
| Label font | Small 8pt = 10.667px, regular | `SDetailsView.cpp:1371`, `StarshipCoreStyle.cpp:1215-1216` |
| Label colour | `--foreground` unchecked, `--foreground-hover` on hover and when checked | `StarshipCoreStyle.cpp:1633-1638` |

## Do

- Let pills take their natural width and wrap. Do not force equal widths.
- Keep the outline `--input`. It reads as a dark hairline between neighbouring pills and around the Primary pill.

## Don't

- Do not use `--input-outline` or `--secondary` for the outline.
- Do not change the pill text to bold when checked. Only the fill and the foreground change.
- Do not style these as tabs with an underline. They are toggle buttons.
