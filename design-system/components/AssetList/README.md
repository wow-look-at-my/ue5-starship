# AssetList

The list view of an asset view (`SAssetView` with `EAssetViewType::List`): a header with a revision control column and a Name column. A scrolling listbox of asset rows, and the item count line under it. Each row is a square thumbnail as tall as the row with a 2px type-colour strip, then the asset name over its class. The asset picker in a property menu uses this view (`SPropertyMenuAssetPicker.cpp:141`).

`AssetTile` is the tile view of the same asset view. Use `AssetList` where the source asks for `EAssetViewType::List`.

## Markup contract

```html
<ue-asset-list>                                 <!-- show-engine shows the /Engine/ rows -->
	<div class="AssetList">
		<ue-header-row grips="off"><div class="hr-row"><div class="hr-cells">
			<div class="hr-cell is-fixed" style="--hr-fixed:30px"><svg class="hr-icon" viewBox="0 0 16 16">...</svg></div>
			<div class="hr-cell is-text" role="columnheader" tabindex="0" aria-sort="ascending" data-column="name">Name</div>
			<div class="hr-spacer"></div>
		</div><div class="hr-rule"></div></div></ue-header-row>
		<ue-scrollbar>
			<div class="sb-scroll AssetList__scroll">
				<div class="sb-view AssetList__view">
					<div class="AssetList__rows" role="listbox" tabindex="0" aria-label="Assets">
						<div class="AssetList__row" role="option" aria-selected="false" data-id="SM_Chair" data-path="/Game/Props/SM_Chair.SM_Chair">
							<span class="AssetList__rc"></span>
							<span class="AssetList__thumb"><svg viewBox="0 0 32 32">...</svg><i class="AssetList__strip" style="--strip:#29f1f2"></i></span>
							<span class="AssetList__text"><span class="AssetList__name">SM_Chair</span><span class="AssetList__class">Static Mesh</span></span>
						</div>
					</div>
				</div>
				<div class="sb sb-v" aria-hidden="true"><div class="sb-thumb"></div></div>
			</div>
		</ue-scrollbar>
		<div class="AssetList__count" role="status">1 item</div>
	</div>
</ue-asset-list>
```

- The header is a `ue-header-row` and the scroll box is a `ue-scrollbar`. Their markup follows their own READMEs. The element hides the header `.hr-spacer` while the scrollbar is hidden.
- `data-id` is the row id in events and the API. Without it the name text is the id. `data-path` is the object path. A path under `/Engine/` is engine content, hidden until `show-engine` or `showEngine` is set.
- The thumbnail holds a cube `<svg>` or an `<img class="AssetList__image">`. The strip colour is the CSS variable `--strip`.
- The element sets `hidden` on filtered rows and `is-odd` on every second visible row, so the stripes skip hidden rows. The count line follows `SAssetView::GetAssetCountText`: `N items`, `1 item`, `N items (M selected)`.
- A forced specimen uses `is-hover` on a row and `aria-selected="true"`, and sits in a `<ue-asset-list data-pinned>`. An author then writes `is-odd` by hand.
- The list takes the free height of a flex column. Give its container a height.

## Selection and keys

- One row at most is selected. A click selects the row and activates it, as a click in a picker sets the value (`SAssetPicker.cpp:578-587`).
- On the focused list, Up and Down move the selection and wrap at the ends (`SAssetView::AdjustActiveSelection`, `SAssetView.cpp:1902-1939`). Home and End jump. Enter activates the selection.
- A click on Name flips the sort between ascending and descending.

## Events

Both events bubble. A handler ignores an event from a nested `ue-asset-list`.

| Event | `detail` | When |
|---|---|---|
| `ue-asset-list-select` | `{ id: string \| null }` | The selected row changed by a click or a key |
| `ue-asset-list-activate` | `{ id: string }` | A click, Enter on the list, or `activate()` |

## Data API

```ts
interface AssetItem {
	id: string;
	label: string;
	typeLabel?: string;  // "Static Mesh", under the name
	path?: string;       // object path; under /Engine/ is engine content
	strip?: string;      // CSS colour of the 2px strip
	thumb?: string;      // image URL; without it the row draws a cube
}
el.setItems(items: AssetItem[]);  // replaces every row, sorted by name
el.query = 'chair';               // shows the rows whose name contains the text, ignoring case
el.showEngine = true;             // shows the /Engine/ rows
el.selectedId;                    // the selected id or null
el.select(id | null);             // selects without an event and scrolls the row into view
el.move(+1 | -1);                 // moves the selection with wrap, as the search box Up and Down do
el.activate();                    // activates the selection or the first visible row; returns its id or null
el.pathOf(id);                    // the data-path of a row
el.visibleRows();                 // the rows the filters leave
```

The API works before the element's own setup runs, so an owner such as `ue-asset-picker` can drive it from its setup.

## Metrics

| Part | Value | Source |
|---|---|---|
| Row height | `(ListViewThumbnailSize 64 + 2 x ListViewThumbnailPadding 4) x Lerp(Min, Max, Scale)`, about **36** at Medium on a 1080p display at 125%, the scale `AssetTile` uses | `SAssetView.cpp:1107-1109, 1126-1127, 5589-5617, 5708-5711` |
| Thumbnail box | square, as tall as the row; padding `ThumbnailPadding - 4` = 0 | `AssetViewWidgets.cpp:1894-1906, 1986-1988` |
| Thumbnail fill | `--recessed`; 2px type-colour strip on the bottom edge | `AssetThumbnail.cpp:1050-1054` |
| Name and class box | slot padding left 6, each line padding 0,1, vertically centred | `AssetViewWidgets.cpp:1908-1941` |
| Name font | `ContentBrowser.AssetTileViewNameFont` Regular 9 = 12px | `ContentBrowserStyle.cpp:96`, `AssetViewWidgets.cpp:1920` |
| Class font | `ContentBrowser.AssetListViewClassFont` Light 10 = 13.333px | `ContentBrowserStyle.cpp:80`, `AssetViewWidgets.cpp:1937` |
| Text colour | `--foreground`; `--white` when hovered or selected | `AssetViewWidgets.cpp:1866-1876` |
| Even row / odd row | `--recessed` / `--background` | `ContentBrowserStyle.cpp:101-106` |
| Hovered row | `--select-hover` | `ContentBrowserStyle.cpp:104,106` |
| Selected row | `--select` while the list has the focus, else `--select-inactive` | `ContentBrowserStyle.cpp:108-111` |
| Revision control column | fixed 30, centred 16x16 state icon | `SAssetView.cpp:2576-2585`, `AssetViewWidgets.cpp:1952-1961` |
| Name column | fill, sortable | `SAssetView.cpp:2587-2593` |
| Count line | NormalText 10pt = 13.333px, padding 8,5 | `SAssetView.cpp:1371-1387` |

## Do

- Keep the selection on the inactive brush while another widget, such as a search box, holds the focus.
- Hide engine content until the view options ask for it.

## Don't

- Do not shrink the thumbnail inside the row. It fills the row height.
- Do not give the list its own background. The rows paint the stripes.

## Icons

The revision control icon and the cube thumbnail are stroke approximations. The Starship SVGs are not in the source tree. The class font is Roboto Light. The preview loads weight 300.
