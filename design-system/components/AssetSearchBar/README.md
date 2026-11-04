# AssetSearchBar

The search row at the top of the area of the Content Browser asset: a pill-shaped search field with a leading magnifier. This also covers an icon button to save the search, and a filter icon button with a dropdown chevron. A chosen filter appears as a removable chip under the row.

## Composed from

| Part | Built from |
|---|---|
| Search field | `ue-text-input` (`textinput--search`). The in-field plus-circle sits in its `textinput__trail` slot |
| Save-search button, plus-circle | `ue-button` (`button--simple button--icon`) |
| Filter dropdown | `ue-combo-button` (`combobutton--icon`, action mode) with a `ue-popup-menu` of check rows |
| Filter chips | `ue-filter-pills` (chip variant) |

The composite owns only the layout of the row (`src/AssetSearchBar/AssetSearchBar.css`) and the wiring. A checked row adds a chip, a removed chip unchecks its row, the plus shows only while the field text.

## What the consumer provides

- Hint text ("Search <current folder>") through `setPlaceholder`, the typed text and the `assetsearchbar:change` handler.
- A handler for `assetsearchbar:save`.
- The filter rows as `ue-popup-menu` check rows. `data-value` names the filter. The colour of its chip comes from the name in `AssetSearchBar.ts`.

## API

```ts
el.text: string;                         // the text of the field
el.setPlaceholder(text: string): void;   // the hint
el.setText(text: string): void;          // as typing would: the clear X and the change event follow
```

| Event | `detail` | When |
|---|---|---|
| `assetsearchbar:change` | `{ text, filters }` | The text changed, or a filter chip came or went. `filters` lists the chip names in order |
| `assetsearchbar:save` | `{ text }` | The save-search button or the plus-circle was pressed |

## Metrics owned by the row

| Part | Value | Source |
|---|---|---|
| Row padding | 6px left, 4px top and bottom | `SContentBrowser.cpp:1362` |
| Field width | 500px | `SContentBrowser.cpp:1249,1380` |
| Gap between the buttons | 2px | `SContentBrowser.cpp:1369` |

The pill field, the clear X, the hint, the buttons, the filter chips. The check rows follow the TextInput, Button, ComboButton, PopupMenu and FilterPills READMEs.

## Do

- Keep the clear X and the plus tied to the text. They show only while the field text.
- Put the filter button first for the 5.5.3 source layout. The reference screenshot has the field first.

## Don't

- Do not draw the chips inside the row. They wrap below it.
