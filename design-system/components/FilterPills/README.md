# FilterPills

The strip of the tab of the Details panel section: toggle pills that wrap onto several lines, with the active pill filled in Primary.

One `<ue-filter-pills>` wraps exactly one `.FilterPills-strip`. The strip is either a tablist of toggle pills or a list of removable chips.

## Markup contract

```html
<!-- Tablist variant: one checked pill, roving focus -->
<ue-filter-pills>
	<div class="FilterPills-strip" role="tablist">
		<button class="FilterPills-pill" role="tab" aria-selected="false" tabindex="-1" data-value="general">General</button>
		<button class="FilterPills-pill is-checked" role="tab" aria-selected="true" tabindex="0" data-value="">All</button>
	</div>
</ue-filter-pills>

<!-- Chip variant: removable filters with a colour segment -->
<ue-filter-pills>
	<div class="FilterPills-strip FilterPills-strip--chips" role="list">
		<span class="FilterPills-chip" role="listitem" data-id="staticmesh" aria-label="Filter: Static Mesh">
			<span class="FilterPills-chipColor" style="background: var(--accent-blue)"></span>
			<span class="FilterPills-chipName">Static Mesh</span>
			<button class="FilterPills-chipRemove" type="button" aria-label="Remove Static Mesh filter"><svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
		</span>
	</div>
</ue-filter-pills>
```

- `data-value` names a pill, else its text. The element sets `is-checked`, `aria-selected` and `tabindex` (the checked pill is 0). Left, Up, Right and Down move and wrap, Home and End jump.
- `data-id` names a chip, else its name text. The X is inline, so no `<symbol>` is needed. An empty chip strip takes no room.
- The tablist look is the Details section pill: `padding: 4px 16px`, 10.667px text, `--header` fill, `--primary` when checked. `components/DetailsCategory/preview.html:95-99` repeats these values for its own strip, and `StarshipCoreStyle.cpp:922-930` is the source. The chip look is `components/AssetSearchBar/preview.html:56-65`: 22px tall, `--secondary` fill, radius 3, an 8px colour segment, the name with 6px padding each side, a 16px X button.

## Events

All events bubble and are composed. A handler ignores an event from a nested `ue-filter-pills`.

| Event | `detail` | When |
|---|---|---|
| `ue-filter-change` | `{ value, label }` | Another pill became checked. Clicking the checked pill fires nothing |
| `ue-pill-add` | `{ id, label, color }` | `addChip` or `setChips` added a chip |
| `ue-pill-remove` | `{ id, label }` | A chip went away, by its X, `removeChip` or `setChips` |

## Data API

```ts
el.value: string;                                   // value of the checked pill; the setter checks a pill and fires ue-filter-change
el.setPills([{ value, label, checked? }]);          // replaces every pill, role tablist
el.addChip({ id, label, color? });                  // appends a chip, turns the strip into the chip variant; a repeated id is ignored
el.removeChip(id);
el.setChips([{ id, label, color? }]);               // removes chips that are not listed, appends the new ones
el.getChips(): { id, label, color }[];
```

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
