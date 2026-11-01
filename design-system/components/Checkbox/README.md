# Checkbox

An 18px dark box with a blue check or dash glyph, plus the toggle-button form that fills a whole button with Primary when on.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (`SetupCheckboxStyles`, lines 1571-1752), abbreviated `SCS`. This also covers margins in `Runtime/SlateCore/Public/Styling/CoreStyle.h`, abbreviated `CS.h`. This also covers layout in `Runtime/Slate/Private/Widgets/Input/SCheckBox.cpp`. The editor adds only derived toggle styles (for example `StarshipStyle.cpp:3254`).

## What the consumer provides

- The label widget. The checkbox style gives it white foreground in every state (`SCS:1580-1586`).
- The state: unchecked, checked or undetermined.
- The Starship check and indeterminate SVGs (`Starship/CoreWidgets/CheckBox/check`, `.../indeterminate`) are not available. `preview.html` draws a 2px stroke approximation.

## Metrics: Checkbox

Slate unit = 1px.

| Property | Value | Source |
|---|---|---|
| Box size | 18 x 18 | `SCS:1597` (`Icon18x18`) |
| Box radius | 3px | `SCS:1574` |
| Box outline | 1px | `SCS:1575` |
| Box fill | `--input` in every state | `SCS:1597-1599` |
| Box outline normal / hovered / pressed | `--secondary` / `--hover` / `--hover` | `SCS:1597-1599` |
| Glyph size | 16 x 16, centred in the 18px box | `SCS:1591`; layout `SCheckBox.cpp:522-540` |
| Check glyph normal / hovered / pressed | `--primary` / `--primary-hover` / `--primary-press` | `SCS:1591-1593` |
| Indeterminate glyph | the same three colours | `SCS:1594-1596` |
| Unchecked glyph | none | `SCS:1588-1590` |
| Label foreground, all states | `--foreground-hover` | `SCS:1580-1586` |
| Label padding | 2 on the left | `SlateTypes.cpp:24` (class default; `SCS` sets none) |
| Label alignment | vertically centred | `SCheckBox.cpp:543` |
| Disabled look | normal look at 45% alpha | `SlateElementPixelShader.usf:535` |

## Metrics: ToggleButtonCheckbox

| Property | Value | Source |
|---|---|---|
| Padding | 16 left/right, 2 top/bottom | `CS.h:113` (`ToggleButtonMargins`), `SCS:1639` |
| Radius | 4px, no outline | `SCS:1627-1632` |
| Checked fill normal / hovered / pressed | `--primary` / `--primary-hover` / `--dropdown` | `SCS:1627-1629` |
| Unchecked fill normal | none | `SCS:1630` |
| Unchecked fill hovered / pressed | `--dropdown` | `SCS:1631-1632` |
| Foreground unchecked normal | `--foreground` | `SCS:1633` |
| Foreground hovered, pressed, checked | `--foreground-hover` | `SCS:1634-1638` |
| Resulting height (16px text) | 20px | derived: 16 + 2 + 2 |

The 16px text line box is derived from Roboto metrics, not read from source.

## Markup contract

One `<ue-checkbox>` wraps exactly one control. The CSS lives in `src/Checkbox/Checkbox.css`. Glyphs are inline `svg` elements with a `viewBox`.

```html
<ue-checkbox>
	<span class="checkbox" role="checkbox" tabindex="0" aria-checked="false" data-label="Simulate Physics">
		<span class="checkbox__box">
			<svg class="checkbox__glyph checkbox__glyph--check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg>
			<svg class="checkbox__glyph checkbox__glyph--mixed" viewBox="0 0 16 16"><path d="M4 8h8"/></svg>
		</span>
		<span class="checkbox__label">Simulate Physics</span>
	</span>
</ue-checkbox>
```

| Variant | Markup |
|---|---|
| Box with label | as above |
| Box only, no visible label | leave out `.checkbox__label` and set `aria-label` on `.checkbox` |
| Tri-state | add `checkbox--tristate`. The state cycles `false`, `true`, `mixed` |
| Toggle button | `<span class="checkbox-toggle" role="button" tabindex="0" aria-pressed="false">Physics</span>`. A checked toggle also has `checkbox-toggle--checked` |
| Disabled | `aria-disabled="true"` |

The box draws the glyph of its `aria-checked` state: none for `false`, the check for `true`, the dash for `mixed`. The control needs both glyph elements to be live. A static specimen carries one `checkbox__glyph` of its state.

Forced state classes for pinned specimens: `checkbox--hover`, `checkbox--pressed`, `checkbox--disabled`, `checkbox-toggle--hover`, `checkbox-toggle--pressed`, `checkbox-toggle--disabled`.

## Events

| Event | Detail | When |
|---|---|---|
| `ue-checkbox-change` | `{ label, state, checked, text }` | The control toggles by click, Enter or Space. `state` is `checked`, `unchecked`, `undetermined`, `on` or `off`. `checked` is `true`, `false`, or `null` for undetermined. `label` is `data-label`, else `aria-label`, else the visible text. `text` is `label is state` |

## Other styles in the same function (not drawn)

| Style | Difference | Source |
|---|---|---|
| `TransparentCheckBox` | toggle button with no fill; foreground `--foreground`, hovered and checked `--foreground-hover` | `SCS:1604-1622` |
| `ToggleButtonCheckboxAlt` | checked fill `--input` r4, hovered `--hover`, checked text white | `SCS:1646-1657` |
| `SegmentedControl` | track `--input` r4, 1px uniform padding; items 8 x 3 padding; checked `--dropdown` | `SCS:1664-1686` |
| `RadioButton` | 16x16 SVG, colours `--dropdown`, `--hover`, `--primary`, `--primary-hover`; padding 4 | `SCS:1730-1750` |

## Do

- Use the box for a boolean. That boolean is in a form row and the toggle button for a mode switch in a button strip.
- Show undetermined with the dash glyph in the same colours as the check.
- Keep the glyph colour tied to the state: Primary, then lighter on hover, darker on press.

## Don't

- Do not fill the checked box with Primary. Only the glyph is blue. The box stays `--input`.
- Do not dim the label on hover or press. It is white in every state.
- Do not use `ToggleButtonCheckbox` for a plain form option.
