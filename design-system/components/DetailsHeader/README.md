# DetailsHeader

The area of the Details panel name: class icon, editable actor name, Add / Blueprint / help buttons, the selection lock, and the selected instance row underneath.

## What the consumer provides

- The class icon (16px) and the actor name text. The name is an inline-editable text block.
- Handlers for Add (opens a component menu), Convert to Blueprint, help (opens documentation) and lock.
- Whether the Blueprint button shows (it hides when the actor is already a Blueprint, where an edit-Blueprint combo replaces it).
- The instance row label. Its selection colour depends on focus: `--select-inactive` (unfocused panel, as in the reference) or `--select` (focused).

Icons in `preview.html` are 16x16 stroke approximations. The Starship SVG files are not in the source tree.

## Composed from

`src/DetailsHeader/DetailsHeader.css` holds only the layout of the name area. Every button is a primitive. The metrics of those buttons are in the [Button README](../Button/README.md).

| Part | Primitive | Count |
|---|---|---|
| Add | `ue-button`, `button--small`, with a plus glyph | 1 |
| Blueprint | `ue-button`, `button--icon` | 1 |
| Help | `ue-button`, `button--simple button--icon` | 1 |
| Lock | `ue-button`, `button--toggle button--icon`. `aria-pressed` is the state | 1 |

Owned by this component: the class icon, the instance row and the editable actor name. The name has no primitive, so `ue-details-header` wires it: Enter commits, Escape restores, and a commit updates the instance row. The padlock glyph carries both shackles, and the component CSS shows one by `aria-pressed` of the lock.

The primitive look wins where it differs from the Slate rows below. A locked padlock is a Primary toggle fill, not a brighter glyph. The Add button uses the `button--small` size.

## Metrics

| Part | Value | Source |
|---|---|---|
| Name area inset | left 10, top 4 | `SActorDetails.cpp:336` |
| Name text slot | padding 0,0,3,0 after an 8px gap | `SDetailNameArea.cpp:138` |
| Name font | Regular 11pt = 14.667px, `--white` | `StarshipStyle.cpp:3148-3153` |
| Add button | SComboButton, "Button" style, radius 4, height 22 | `SActionButton.cpp:98-126`, `ToolWidgetsStylePrivate.h:19-25` |
| Add padding | content (2,1.5) + style (12,1.5) = 14 horizontal, 3 vertical | `ToolWidgetsStyle.cpp:16-21,63`, `StarshipCoreStyle.cpp:1381`, `CoreStyle.h:110` |
| Add fill | `--secondary`, hover `--hover`, pressed `--header`, 1px `--input` outline | `StarshipCoreStyle.cpp:1373-1375` |
| Add icon | plus, `--accent-green`, gap to label 3 | `ToolWidgetsStyle.cpp:76`, `ToolWidgetsStylePrivate.h:23` |
| Add label | Normal 10pt = 13.333px, `--foreground-hover` | `StarshipCoreStyle.cpp:1170-1172,1377,1433` |
| Gap Add to next button | 4 | `SSubobjectInstanceEditor.cpp:74` |
| Blueprint button | "DetailsView.NameAreaButton": Button + padding (6,3), content padding 0 = 28x22 | `StarshipStyle.cpp:3325-3328`, `SSubobjectInstanceEditor.cpp:99-106` |
| Blueprint icon | 16px, white (no tint set) | `SSubobjectInstanceEditor.cpp:112-114` |
| Help button | SSimpleButton: content (2,1) + style (2,1) = 24x20, no fill, hover `--dropdown` r4 | `SDocumentationAnchor.cpp:61-63`, `SSimpleButton.cpp:33-34`, `ToolWidgetsStyle.cpp:123`, `StarshipCoreStyle.cpp:1391,1405-1407` |
| Help left gap | 4 | `SSubobjectInstanceEditor.cpp:141` |
| Lock button | SimpleButton, ContentPadding (4,2) + (2,1) = 28x22, slot padding 4,0,4,0 | `SDetailNameArea.cpp:164-176`, `StarshipCoreStyle.cpp:1405-1407` |
| Lock icons | `PropertyWindow.Locked` / `Unlocked`, 16px, `UseForeground` (`--foreground`, hover `--foreground-hover`) | `StarshipStyle.cpp:3118-3119`, `StarshipCoreStyle.cpp:1394-1395` |
| Components box | padding 2,0,2,0 | `SActorDetails.cpp:269` |
| Instance frame | `--recessed`, radius 4, padding 4 | `StarshipStyle.cpp:4237`, `SSubobjectInstanceEditor.cpp:163-164` |
| Instance row fill | inactive `--select-inactive`, active `--select`; no radius | `StarshipCoreStyle.cpp:2009,2012,2067-2070`, `StarshipStyle.cpp:1146-1148` |
| Instance row padding | top 4, bottom 4 | `SSubobjectEditor.cpp:721` |
| Instance row content | icon margin-left 4, name margin-left 6, "(Instance)" margin-left 4, Normal 10pt, `--foreground-hover` | `SSubobjectEditor.cpp:777,789,797`, `StarshipCoreStyle.cpp:2019,1325-1331` |

## Do

- Keep the button heights as listed: Add and lock are 22px. The help button is 20px. They are not equalised in source.
- Use `--accent-green` for the plus only. The label stays white.
- Let the name text ellipsize. The name slot fills the free width and pushes the buttons right.

## Don't

- Do not add a fill to the lock or help buttons at rest. SimpleButton has no resting fill.
- Do not round the instance row. The row brush is a plain colour brush inside the rounded Recessed frame.
- Do not use `--primary` for the instance row. The reference screenshot sampled `#40576f`, which is `--select-inactive`.
