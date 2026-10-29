Build editor tool windows in the Unreal Engine 5.5 "Starship" look: a dark, flat, panel-on-panel UI of dockable tabs, tool windows and property panes. Every value here was read from the UE 5.5.3 Slate source (`StyleColors.cpp`, `StarshipCoreStyle.cpp`, `StarshipStyle.cpp`, `CoreStyle.h`). Each component README cites the file and line. Where only the 5.8.1 reference checkout had a value, the README says so.

## Content fundamentals

- Write labels in Title Case, as the editor does: "Place Actors", "Content Browser", "Save All", "Select Mode".
- Name a tab or panel by its noun. Never add a verb or a trailing colon.
- Write counts as a plain fragment: "15 actors (1 selected)", "10 items".
- Show a field prompt as a sentence fragment in `foreground` at reduced emphasis: "Search StarterContent", "Enter Console Command".
- Use no emoji. Use no exclamation marks.
- Pair every status colour with an icon or a word. `warning`, `error` and `success` never carry meaning alone.

## Visual foundations

- The system has one theme, Dark. Never invert it.
- **Layers.** A window sits on `recessed`. Panel content sits on `panel`. Tab wells and major-tab content sit on `background`. Headers and category bars sit on `header`. Inputs sit on `input`. Separate layers by ground colour, not by shadow.
- **Text.** Set body text in `normal` and colour it `foreground`. On hover, on a `primary` fill and on a selected row, switch to `foreground-hover`. On a `header` ground use `foreground-header`. Use `small` for captions and tile labels, `small-bold` for section titles.
- **Selection.** A selected row in the focused view is `select`. An unfocused view uses `select-inactive` with `foreground-hover` text. A collapsed row that contains the selection is `select-parent`. A hovered row is `select-hover`.
- **Accent.** `primary` is the single action colour: primary buttons, active toggles, active category tabs, the focus ring. Never use an `accent-*` colour as a button fill.
- **Focus.** Draw a 1px `primary` ring with `radius-input` around the focused control.
- **Radii.** Use `radius-input` (4px) for inputs, buttons and panel borders, `radius-chip` for filter chips, `radius-window` for windows. Rows and tabs are flat or almost flat.
- **Spacing.** Metrics are Slate units and are not snapped to a grid: a tab padding of 4, 3, 10, stays 4, 3, 10, 4. Read each component README for its exact values.
- **Scrollbars.** Use an 8px thumb with `radius-input`, `hover` at rest and `hover-2` on hover. Draw no track.
- **Motion.** The source has no motion tokens. Add none.
- **Imagery.** The viewport in the editor is a live 3D render and is not part of this system. `assets/Placeholders/viewport-placeholder.png` stands in for it. Never redraw or restyle it.

## Iconography

- Use 16px icons in rows and tabs, 20px in toolbars, 8px for combo carets.
- Starship draws its icons as single-colour SVGs tinted by the state colour. Those SVG files are not in the source tree available here. Every icon in the previews is a hand-drawn 16px stroke stand-in. Replace them with the real Starship icons before shipping a product UI.
- Tint an icon with `foreground` at rest and `foreground-hover` on hover.
- The folder icon uses `accent-folder`.

## Using the components

Each component folder holds a README with an exact metrics table and a live preview. Compose a tool window from them in this order. Window chrome, tab well, then inside a tab the toolbar, search row, header row and tree or property grid, then the status line.

The EditorLayout card shows the whole window assembled from the components, with the viewport placeholder in the centre tab. Copy its arrangement. Place Actors sits at the left. The viewport in the middle, Details above Outliner at the right, Content Browser across the bottom and the status bar last.

Groups: Docking (DockTab, TabWell, WindowChrome, Splitter), Toolbars (MenuBar, ToolBar, PlaceActorsPanel, StatusBar), Details (DetailsHeader, DetailsSearchRow, FilterPills, DetailsCategory, VectorInput, SegmentedControl, AssetPicker), Outliner (TreeRow, HeaderRow, SceneOutliner, Scrollbar), Content Browser (ContentToolbar, SourcePanel, AssetTile, AssetSearchBar, ContentBrowser), Controls (Button, ComboButton, Checkbox, TextInput, SpinBox, Slider, Tooltip, PopupMenu, Notification, ExpandableArea, ResetToDefault), Layout (EditorLayout).

Use `axis-x`, `axis-y` and `axis-z` for the 2px edge bars on vector fields.

## Live components

Every previewed component is a light-DOM custom element named `ue-<component>`, for example `ue-tab-well`, `ue-tool-bar` and `ue-spin-box`. The element wraps the component markup and keeps its class names. The look is the same and the page CSS still applies. The design system page preloads `components/bundle.js`, which defines every element, so a preview carries no script tag.

- Write behaviour in TypeScript under `src/<Name>/<Name>.ts` and extend `UeElement` from `src/_shared/element.ts`. Compile with `ts0 build`. `components/bundle.js` (all elements, for the design system page) and each `components/<Name>/<Name>.js` (one ES module per component, for use outside the page) are generated by ts0 and must never be edited by hand.
- Set state with `aria-*` and `data-*` attributes and with the same state classes the pinned specimens use. Keep every `:hover`, `:active` and `:focus-visible` rule same to the forced-state class it mirrors.
- Mark a documentation specimen that shows a forced state with `data-pinned` and leave it outside any custom element.
- Make every interactive element keyboard operable and give it the matching `role` and `aria-*` attributes.
