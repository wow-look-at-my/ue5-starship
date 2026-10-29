# ComboButton

A dark input-style button with a trailing caret that opens a popup. `ComboBox` rows and `SimpleComboButton` (borderless) share the same parts.

Source of truth: `Runtime/SlateCore/Private/Styling/StarshipCoreStyle.cpp` (`SetupComboButtonStyles`, lines 1467-1569), abbreviated `SCS`. This also covers margins in `Runtime/SlateCore/Public/Styling/CoreStyle.h`, abbreviated `CS.h`. This also covers layout in `Runtime/Slate/Private/Widgets/Input/SComboButton.cpp`. The editor only derives variants (`StarshipStyle.cpp:3228-3233` category combo, `:3330-3334` name-area combo).

## What the consumer provides

- The label content. `ComboButton` content padding is 0 (`SCS:1490`). The label sits directly at the button padding.
- The popup content (`MenuContent`). The popup is not part of the button style. A `ComboBox` fills it with rows.
- The caret is part of the style. The SVG `Starship/CoreWidgets/ComboBox/wide-chevron-down` is not available, so `preview.html` draws an approximation.

## Metrics

Slate unit = 1px. The 16px text line box is derived from Roboto metrics, not read from source.

| Property | Value | Source |
|---|---|---|
| Fill (all states except disabled) | `--input` | `SCS:1471-1473` |
| Radius | 4px | `SCS:1471`, `CS.h:117` |
| Outline normal | 1px `--input-outline` | `SCS:1471`, `CS.h:118` |
| Outline hovered and pressed | 1px `--hover` | `SCS:1472-1473` |
| Disabled brush (style) | fill `--dropdown`, outline `--dropdown-outline` | `SCS:1474` |
| Disabled look (engine default) | normal brush at 45% alpha | `SlateElementPixelShader.usf:535` |
| Foreground normal | `--foreground` | `SCS:1475` |
| Foreground hovered, pressed, disabled | `--foreground-hover` | `SCS:1476-1478` |
| Button padding normal | 8 left/right, 1 top/bottom | `CS.h:114` |
| Button padding pressed | 8, top 2, bottom 0 | `CS.h:115` |
| Content padding | 0 | `SCS:1490` |
| Caret image | 16x16 | `SCS:1491` |
| Caret padding | 2 on every side (class default) | `SlateTypes.cpp:165` |
| Caret vertical alignment | centre | `SlateTypes.cpp:166` |
| Resulting height | 22px: 16px caret + 2 + 2 padding + 1 + 1 | derived |
| Caret colour | inherits the button foreground | `SComboButton.cpp:82` |
| Popup fill | `--dropdown`, radius 0 | `SCS:1492` |
| Popup outline | 1px `--dropdown-outline` | `SCS:1492` |
| Popup padding | 0 | `SCS:1493` |
| ComboBox row padding | 8 left/right, 3 top/bottom | `SCS:1503` |
| ComboBox row hovered fill | `--primary`, full row, no radius | `SCS:1534-1547` |
| ComboBox row text | `--foreground-hover` (white) | `SCS:1549-1550` |
| ComboBox row keyboard focus | 1px `--select` ring, radius 4, transparent fill | `SCS:1539` |
| ComboBox active and selected row | no brush | `SCS:1541` |
| SimpleComboButton button | `SimpleButtonLabelAndIcon`: no fill; `--dropdown` r4 on hover; padding 4 x 1 | `SCS:1511-1521`, `1389-1403` |
| SimpleComboButton foreground | `--foreground`, `--foreground-hover` hovered | `SCS:1394-1396` |
| SimpleComboBox row padding | 8 left/right, 2 top/bottom | `SCS:1528` |

## Open state

The source has no separate open brush. The button uses click method MouseDown (`SComboButton.cpp:35`), so the pressed brush (outline `--hover`, padding shift) is what shows while the popup opens. `preview.html` shows that look with the popup below.

## Do

- Use `ComboButton` for a value picker. Use `SimpleComboButton` for a menu opener inside a toolbar.
- Keep the caret on the right, 20px wide including padding.
- Let the hovered row fill the whole popup width.

## Don't

- Do not draw a separate selected-row highlight. The `ComboBox.Row` style has none.
- Do not add a gap or shadow between the button and the popup. The source defines none.
- Do not give the popup rounded corners. The popup brush radius is 0.

## Markup contract

One `<ue-combo-button>` is one trigger and one dropdown panel. This is the trigger and dropdown primitive for the whole system: value pickers, toolbar combos, gear menus, Add menus and status bar combos. The CSS lives in `src/ComboButton/ComboButton.css`. The panel rows come from `ue-popup-menu`, so rows, check marks, radio marks, separators, headings and submenus follow the PopupMenu README.

```html
<ue-combo-button>
	<div class="combobutton-anchor">
		<span class="combobutton" role="combobox" tabindex="0" aria-haspopup="menu" aria-expanded="false">
			<span class="combobutton__label">Location</span>
			<svg class="combobutton__arrow" viewBox="0 0 16 16"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg>
		</span>
		<div class="combobutton-menu" hidden>
			<ue-popup-menu>
				<div class="popupmenu popupmenu--combo" role="menu" tabindex="0">
					<div class="popupmenu__row" role="menuitem"><span class="popupmenu__body"><span class="popupmenu__label">Location</span></span></div>
				</div>
			</ue-popup-menu>
		</div>
	</div>
</ue-combo-button>
```

| Part | Rule |
|---|---|
| `.combobutton-anchor` | Required. It is the positioning box of the panel and the outside-click boundary |
| `.combobutton` | The trigger. Needs `tabindex="0"`, `aria-haspopup="menu"` and `aria-expanded`. `aria-disabled="true"` disables it |
| `.combobutton__label` | The text. Omit it for an icon-only trigger |
| `.combobutton__icon` | An optional leading inline `svg` with a `viewBox` |
| `.combobutton__arrow` | The chevron, an inline `svg` with a `viewBox` |
| `.combobutton-menu` | The panel. Carries `hidden`. Holds exactly one `ue-popup-menu` |

The host owns open and close, an outside click, Escape, Down, Up, Enter and Space on the trigger, and the focus return to the trigger. The popup menu owns row keys and activation.

## Modes

| Mode | How | Behavior |
|---|---|---|
| Value | default | The trigger label follows the pick. The picked row gets `aria-selected="true"`, the others `false` |
| Action | `combobutton--simple` on the trigger, or `mode="action"` on the host, or a trigger without a label | The label stays fixed. Rows only fire events |

A check row never changes the label.

## Variants

| Class | Look |
|---|---|
| none | Boxed trigger, `--input` fill, 120px minimum width |
| `combobutton--simple` | Transparent, `--dropdown` on hover, padding 4 x 1 |
| `combobutton--icon` | Transparent icon plus chevron, no label, padding 4 x 3 |
| `combobutton--small` | Property row size: `400 10.667px/1.172` font, fixed 22px height, no minimum width |
| `combobutton--button` | The Button look: `--secondary` fill, fixed 22px height, padding 14, 3px gap. The plus icon is `--accent-green` (`ToolWidgetsStyle.cpp:76`) |
| `combobutton-anchor--fill` (on the anchor) | The trigger takes the free width of a row |
| `combobutton-menu--end` (on the panel) | The panel aligns to the right edge of the trigger |

Panel width: the panel is at least as wide as the trigger. Set `--combobutton-menu-min-width` on the panel to change the minimum. Use `popupmenu--combo` on the list for value pickers and `popupmenu--small` for 10.667px rows.

## Events

| Event | Detail | When |
|---|---|---|
| `ue-combo-pick` | `{ value, label, checked }` | A row is activated. `value` is the row `data-value` or its label. `checked` is the new state of a check or radio row, else `null` |
| `ue-menu-activate` | see PopupMenu | Also bubbles from the nested popup menu |
