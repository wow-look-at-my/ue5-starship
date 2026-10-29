# TextInput

A dark rounded text field (`EditableTextBox`) and its pill-shaped variant with a leading magnifier (`SearchBox`).

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (`SetupTextStyles`, lines 1164-1351), abbreviated `SCS`. This also covers constants in `Runtime/SlateCore/Public/Styling/CoreStyle.h`, abbreviated `CS.h`. This also covers layout in `Runtime/Slate/Private/Widgets/Input/SEditableTextBox.cpp` and `SSearchBox.cpp`. The editor style does not override these. It derives variants from `NormalEditableTextBox` (`StarshipStyle.cpp:176`).

## What the consumer provides

- The value text, a hint text (for example "Search...") and a minimum width. The style gives no width.
- For the search box, the search behaviour. The glass and clear button are part of the widget.
- The Starship SVGs `search` and `close` are not available. `preview.html` draws approximations.

## Metrics: EditableTextBox

Slate unit = 1px. The 16px text line box is derived from Roboto metrics, not read from source.

| Property | Value | Source |
|---|---|---|
| Fill (normal, hovered, focused) | `--input` | `SCS:1284-1286` |
| Radius | 4px | `SCS:1284`, `CS.h:117` |
| Outline normal / hovered / focused | 1px `--input-outline` / `--hover` / `--primary` | `SCS:1284-1286`, `CS.h:118` |
| Read-only fill and outline | `--header` fill, 1px `--input-outline` | `SCS:1287` |
| Text padding | 8 left, 3 top, 8 right, 4 bottom | `SCS:1289`; applied in `SEditableTextBox.cpp:55-56` |
| Font | Normal: 10pt Regular = 13.33px | `SCS:1288`, `1170` |
| Text colour | `--foreground` | `SCS:1290` |
| Focused text colour | `--foreground-hover` (white) | `SCS:1293` |
| Read-only text colour | inherits the parent foreground (`UseForeground`) | `SCS:1292`; `SEditableTextBox.cpp:336-351` |
| Hint text | text colour at 35% alpha, same font | `SlateEditableTextLayout.cpp:3563` |
| Selection fill | `--highlight` | `SCS:1264`, `1174` |
| Caret | white, 1.28px wide (clamp of 0.08 x 16px line height to 1..2px) | `SCS:1272`; `TextEditHelper.h:18`, `TextEditHelper.cpp:17` |
| Resulting height | 23px: 16 + 3 + 4 | derived |

## Metrics: SearchBox

The search style copies the editable text box and replaces the brushes (`SCS:1301-1307`). Everything above stays, including the text padding.

| Property | Value | Source |
|---|---|---|
| Shape | pill: radius is half the height | `SCS:1303-1306` give no radius, the colour-and-width outline constructor sets `HalfHeightRadius` (`SlateBrush.h:161-166`) |
| Outline normal / hovered / focused | 1px `--secondary` / `--hover` / `--primary` | `SCS:1303-1305` |
| Read-only fill and outline | `--header` fill, 1px `--input-outline` | `SCS:1306` |
| Glass image | 16x16 SVG shown at 14x14 | `SCS:1313`, `1316` |
| Glass and clear padding | 4 on the left | `SCS:1315` |
| Glass and clear position | both left of the text | `SCS:1318`; `SSearchBox.cpp:125-137` |
| Clear button | replaces the glass while the text is non-empty; 14x14 image on a hover-only button | `SSearchBox.cpp:148-170`, `251-277` |
| Glyph colour | inherits the box foreground (`--foreground`, white when focused) | `SSearchBox.cpp:144` |
| End spacer | 7px, so the rounded end does not clip the text | `SSearchBox.cpp:172-177` |
| Up and down result arrows | 16x16 chevrons, shown only when a search delegate is bound | `SCS:1311-1312`; `SSearchBox.cpp:57-120` (not drawn) |

## Markup contract

One `<ue-text-input>` wraps exactly one `.textinput` box. The CSS lives in `src/TextInput/TextInput.css`. Glyphs are inline `svg` elements with a `viewBox`.

```html
<ue-text-input>
	<div class="textinput textinput--search">
		<svg class="textinput__glyph textinput__glass" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
		<svg class="textinput__glyph textinput__clear" role="button" aria-label="Clear search" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>
		<input class="textinput__text textinput__field" type="text" placeholder="Search..." aria-label="Search">
		<span class="textinput__tail"></span>
	</div>
</ue-text-input>
```

| Variant | Markup |
|---|---|
| Editable box | `.textinput > input.textinput__text.textinput__field` |
| Read-only | add `textinput--readonly` and the `readonly` attribute on the input |
| Search | add `textinput--search`. Needs `.textinput__glass`, `.textinput__clear` and `.textinput__tail` as above. The pill radius applies. The clear X shows only while the field has text and replaces the glass. Escape clears the field, only in this variant |
| Trailing buttons | put `<span class="textinput__trail">` with the buttons between the input and the tail. A click on the slot does not focus the field |
| Console | add `textinput--console` for the status bar command line: 12px mono text, 4px radius. Escape does nothing special |

Forced state classes for pinned specimens: `textinput--hover`, `textinput--focus`. A pinned specimen holds `.textinput__text` spans, `.textinput__hint`, `.textinput__sel` and `.textinput__caret` in place of an input.

## Events

| Event | Detail | When |
|---|---|---|
| `ue-text-input` | `{ value }` | The text changes by typing, paste, clear button or Escape |
| `ue-text-clear` | `{}` | The search clear button or Escape empties the field. `ue-text-input` with an empty value fires first |

## Do

- Use `EditableTextBox` for values and names, `SearchBox` for filters.
- Show the hint text at 35% alpha of the text colour, not as a separate grey.
- Turn the outline `--primary` on focus and the text white. Change nothing else.

## Don't

- Do not draw the outline as a CSS border. It sits inside the box and adds no size.
- Do not use the pill shape for ordinary fields. Only the search box is round.
- Do not add a glow on focus. The source has only the outline colour change.
