# ContentToolbar

The top row of the Content Browser. Add / Import / Save All actions, history arrows, a breadcrumb path trail and a right-aligned Settings button, all on a Panel-coloured strip 32px high.

## Composed from

| Part | Built from |
|---|---|
| Add | `ue-combo-button` (`combobutton--button`, action mode) with a `ue-popup-menu` |
| Import, Save All | `ue-button` (`button--simple button--tight`) |
| Back, Forward | `ue-button` (`button--simple button--icon`) |
| Crumbs | `ue-button` (`button--simple button--tight`), one per path element |
| Crumb chevrons | `ue-combo-button` (`combobutton--icon`, action mode) with a `ue-popup-menu` of the sub-folders |
| Settings | `ue-combo-button` (`combobutton--simple`, action mode, `combobutton-menu--end`) with check rows |

The composite owns only the layout of the row (`src/ContentToolbar/ContentToolbar.css`), the path, the history and the crumb trail. The breadcrumb has no primitive of its own. The leading folder glyph is in the reference image only.

## What the consumer provides

- The initial crumbs: one `ue-button[data-crumb]` per path element in the markup. The element redraws the trail from its path.
- The menu rows, as `ue-popup-menu` markup (see the PopupMenu README).
- `childrenOf(path)`: the names of the folders inside the folder at `path`. The chevron after a crumb lists them. The default knows the folders of the demo.

The row is: `[tool buttons] [back] [forward] [breadcrumb, fills the remaining width] [Settings]`. Lock and "Dock in Layout" buttons exist in source (`SContentBrowser.cpp:822-844`) but are hidden in the standard browser and are not drawn here.

## API

```ts
el.path: readonly string[];                  // the current crumbs
el.childrenOf: (path: string[]) => string[]; // sub-folders of a path
el.setHistory(entries: string[][], index: number): void; // replace the history, no event
el.navigate(path: string[]): void;           // go to a path and record it, no event
```

| Event | `detail` | When |
|---|---|---|
| `contenttoolbar:navigate` | `{ path }` | The user clicked a crumb, picked a sub-folder or walked Back or Forward |

`ue-button-click` and `ue-combo-pick` of the parts bubble as they are. `data-action` on the `ue-button` or `ue-combo-button` host names the part: `add`, `import`, `save-all`, `back`, `forward`, `settings`.

## Metrics owned by the row

| Part | Value | Source |
|---|---|---|
| Row background / padding | `--panel` / 3px all sides | `SContentBrowser.cpp:764-766` |
| Tool strip left offset | 5px slot padding + 4px toolbar background padding left, 2px top/bottom | `SContentBrowser.cpp:772`, `StarshipStyle.cpp:6624` |
| Separator between tool buttons | 2px wide, no brush, 4px margin each side | `StarshipStyle.cpp:6622-6623`, `ToolBarStyle.cpp:25` |
| Back / forward | back margin-left 10, forward margin-left 2 | `SContentBrowser.cpp:778-797` |
| Breadcrumb slot | fills; margin-left 2 | `SContentBrowser.cpp:816-820` |
| Settings slot | margin-left 5 | `SContentBrowser.cpp:848` |
| Row height | 22 (button) + 2 + 2 (toolbar padding) + 3 + 3 (row padding) = 32 | derived from the rows above |

The look of each button, the menus and the check rows follows the Button, ComboButton and PopupMenu READMEs.

## Do

- Keep every button on a 22px line box so the row stays 32px high.
- Let the breadcrumb take all free width so Settings stays right-aligned.
- Use `mode="action"` on every menu here. A pick fires `ue-combo-pick` and never changes the label.

## Don't

- Do not give the breadcrumb a box: source builds it inside a combo button. However, the reference screenshot shows no outline, and the preview follows the screenshot.
- Do not add an outline or fill to Import / Save All at rest. Only hover paints them.

## Icons

The Starship SVG files are not available. Icons in `preview.html` (plus, import, save-all, circle arrows, chevron, gear, folder) are simple stroke/fill approximations drawn to the 16px grid. Replace them with the real `Starship/Common/*.svg` assets.
